"""
NetScope — Simple Network Scanner
Flask REST API and SSE Backend.
Provides network detection, subnet calculation, live concurrent scanning,
SQLite persistence, and export services.
"""

import csv
import io
import json
import os
import queue
import subprocess
import sys
import threading
import time
from typing import Dict, Any

try:
    from flask import Flask, request, jsonify, Response, send_file
    from flask_cors import CORS
except ImportError:
    Flask = None
    CORS = None

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database
from network_utils import (
    detect_network_interfaces,
    get_default_local_network,
    calculate_subnet_info,
    is_authorized_subnet
)
from scanner import execute_scan, get_target_ips_for_network

def create_app(test_config=None):
    if Flask is None:
        raise RuntimeError("Flask is not installed. Run 'pip install -r requirements.txt'")

    app = Flask(__name__)
    if CORS:
        CORS(app)

    db_path = test_config.get("DB_PATH") if test_config else None
    database.init_db(db_path)

    # Active scan tracking for cancellation and realtime events
    active_scans: Dict[str, Dict[str, Any]] = {}
    active_scans_lock = threading.Lock()

    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({
            "status": "ok",
            "service": "NetScope Python Backend",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        })

    @app.route('/api/network/interfaces', methods=['GET'])
    def get_interfaces():
        try:
            interfaces = detect_network_interfaces()
            return jsonify({"interfaces": interfaces})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/network/detect', methods=['GET'])
    def detect_network():
        try:
            suggested = get_default_local_network()
            return jsonify({"suggested_cidr": suggested})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/subnet/calculate', methods=['GET'])
    def calculate_subnet_endpoint():
        cidr = request.args.get('cidr', '').strip()
        if not cidr:
            return jsonify({"error": "Missing 'cidr' query parameter (e.g., ?cidr=192.168.1.0/24)"}), 400
        try:
            data = calculate_subnet_info(cidr)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app.route('/api/scans', methods=['POST'])
    def start_scan():
        body = request.get_json(silent=True) or {}
        cidr = body.get('cidr', '').strip()
        timeout_ms = int(body.get('timeout_ms', 1000))
        concurrency = int(body.get('concurrency', 10))
        max_hosts = int(body.get('max_hosts', 256))
        allow_public = bool(body.get('allow_public', False))

        if not cidr:
            return jsonify({"error": "CIDR network is required"}), 400

        # Validate CIDR
        try:
            info = calculate_subnet_info(cidr)
        except Exception as e:
            return jsonify({"error": f"Invalid CIDR notation: {e}"}), 400

        # Enforce private/local range safety restriction
        if not allow_public and not is_authorized_subnet(cidr):
            return jsonify({
                "error": "Safety restriction: Public IP ranges cannot be scanned without explicit authorization. Use a private network (RFC 1918) or local loopback."
            }), 403

        if info["total_addresses"] > max_hosts and info["cidr"] < 24:
            return jsonify({
                "error": f"Subnet size ({info['total_addresses']} hosts) exceeds safe limit of {max_hosts} addresses. Please select a /24 or smaller subnet."
            }), 400

        target_ips = get_target_ips_for_network(cidr, max_hosts)
        session_id = database.create_scan_session(cidr, len(target_ips), db_path=db_path)

        cancel_event = threading.Event()
        event_queue = queue.Queue()

        with active_scans_lock:
            active_scans[session_id] = {
                "cancel_event": cancel_event,
                "event_queue": event_queue,
                "cidr": cidr
            }

        def worker():
            def on_host(host_res, checked, total, active):
                try:
                    database.add_scan_result(
                        session_id,
                        host_res["ip_address"],
                        host_res["hostname"],
                        host_res["response_time_ms"],
                        host_res["status"],
                        db_path=db_path
                    )
                    database.update_scan_progress(session_id, checked, active, db_path=db_path)
                except Exception as err:
                    print(f"Error persisting host result: {err}")

                event_queue.put({
                    "event": "host_result",
                    "scan_id": session_id,
                    "host": host_res,
                    "checked_addresses": checked,
                    "total_addresses": total,
                    "active_count": active,
                    "percent": round((checked / total) * 100, 1) if total > 0 else 100
                })

            results, final_status = execute_scan(
                cidr=cidr,
                timeout_ms=timeout_ms,
                concurrency=concurrency,
                max_hosts=max_hosts,
                cancel_event=cancel_event,
                on_host_scanned=on_host
            )

            database.complete_scan_session(session_id, status=final_status, db_path=db_path)

            event_queue.put({
                "event": "complete",
                "scan_id": session_id,
                "status": final_status,
                "checked_addresses": len(results),
                "total_addresses": len(target_ips),
                "active_count": sum(1 for r in results if r["status"] == "Active")
            })

            # Cleanup
            with active_scans_lock:
                active_scans.pop(session_id, None)

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()

        return jsonify({
            "scan_id": session_id,
            "network_cidr": cidr,
            "total_addresses": len(target_ips),
            "status": "running"
        }), 201

    @app.route('/api/scans', methods=['GET'])
    def list_scans():
        sessions = database.list_scan_sessions(limit=50, db_path=db_path)
        return jsonify({"sessions": sessions})

    @app.route('/api/scans/<scan_id>', methods=['GET'])
    def get_scan(scan_id):
        session = database.get_scan_session(scan_id, db_path=db_path)
        if not session:
            return jsonify({"error": "Scan session not found"}), 404
        return jsonify(session)

    @app.route('/api/scans/<scan_id>/results', methods=['GET'])
    def get_results(scan_id):
        session = database.get_scan_session(scan_id, db_path=db_path)
        if not session:
            return jsonify({"error": "Scan session not found"}), 404
        results = database.get_scan_results(scan_id, db_path=db_path)
        return jsonify({"session": session, "results": results})

    @app.route('/api/scans/<scan_id>/events', methods=['GET'])
    def scan_events(scan_id):
        with active_scans_lock:
            scan_data = active_scans.get(scan_id)

        def event_stream():
            if not scan_data:
                # If already completed or not found, send complete state
                sess = database.get_scan_session(scan_id, db_path=db_path)
                if sess:
                    yield f"data: {json.dumps({'event': 'complete', 'scan_id': scan_id, 'status': sess['status']})}\n\n"
                else:
                    yield f"data: {json.dumps({'event': 'error', 'message': 'Session not found'})}\n\n"
                return

            q = scan_data["event_queue"]
            while True:
                try:
                    msg = q.get(timeout=25.0)
                    yield f"data: {json.dumps(msg)}\n\n"
                    if msg.get("event") == "complete":
                        break
                except queue.Empty:
                    # Keep-alive heartbeat
                    yield ": keep-alive\n\n"

        return Response(event_stream(), mimetype="text/event-stream")

    @app.route('/api/scans/<scan_id>/cancel', methods=['POST'])
    def cancel_scan(scan_id):
        with active_scans_lock:
            scan_data = active_scans.get(scan_id)

        if scan_data:
            scan_data["cancel_event"].set()
            return jsonify({"message": "Cancellation signal sent", "scan_id": scan_id})

        # If not active in memory, update DB status directly
        database.complete_scan_session(scan_id, status="cancelled", db_path=db_path)
        return jsonify({"message": "Scan marked as cancelled", "scan_id": scan_id})

    @app.route('/api/scans/<scan_id>', methods=['DELETE'])
    def delete_scan(scan_id):
        success = database.delete_scan_session(scan_id, db_path=db_path)
        if not success:
            return jsonify({"error": "Scan session not found"}), 404
        return jsonify({"message": "Scan deleted successfully", "scan_id": scan_id})

    @app.route('/api/export/scans/<scan_id>.csv', methods=['GET'])
    def export_csv(scan_id):
        session = database.get_scan_session(scan_id, db_path=db_path)
        if not session:
            return jsonify({"error": "Scan session not found"}), 404
        results = database.get_scan_results(scan_id, db_path=db_path)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Scan ID", "Network CIDR", "IP Address", "Hostname", "Response Time (ms)", "Status", "Scanned At"])

        for r in results:
            writer.writerow([
                scan_id,
                session["network_cidr"],
                r["ip_address"],
                r["hostname"] or "N/A",
                r["response_time_ms"] if r["response_time_ms"] is not None else "N/A",
                r["status"],
                r["scanned_at"]
            ])

        response = Response(output.getvalue(), mimetype="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename=netscope_scan_{scan_id[:8]}.csv"
        return response

    @app.route('/api/export/scans/<scan_id>.json', methods=['GET'])
    def export_json(scan_id):
        session = database.get_scan_session(scan_id, db_path=db_path)
        if not session:
            return jsonify({"error": "Scan session not found"}), 404
        results = database.get_scan_results(scan_id, db_path=db_path)

        data = {
            "session": session,
            "results": results
        }
        response = Response(json.dumps(data, indent=2), mimetype="application/json")
        response.headers["Content-Disposition"] = f"attachment; filename=netscope_scan_{scan_id[:8]}.json"
        return response

    @app.route('/api/analytics/summary', methods=['GET'])
    def analytics_summary():
        summary = database.get_analytics_summary(db_path=db_path)
        return jsonify(summary)

    @app.route('/api/analytics/history', methods=['GET'])
    def analytics_history():
        history = database.get_analytics_history(limit=15, db_path=db_path)
        return jsonify({"history": history})

    return app

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app = create_app()
    print(f"NetScope Python Flask Backend running on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
