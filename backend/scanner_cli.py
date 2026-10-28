#!/usr/bin/env python3
"""
NetScope Scanner CLI Bridge.
Invoked by backend or terminal to perform a scan session, persist progress
to SQLite, and output realtime streaming JSON events to stdout.
"""

import argparse
import json
import os
import signal
import sys
from threading import Event

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import (
    init_db,
    update_scan_progress,
    add_scan_result,
    complete_scan_session,
    get_scan_session
)
from scanner import execute_scan, get_target_ips_for_network

def main():
    parser = argparse.ArgumentParser(description="NetScope Scanner Worker")
    parser.add_argument("--scan-id", required=True, help="Scan session ID")
    parser.add_argument("--cidr", required=True, help="IPv4 CIDR network to scan")
    parser.add_argument("--timeout", type=int, default=1000, help="Ping timeout in milliseconds")
    parser.add_argument("--concurrency", type=int, default=10, help="Maximum concurrent workers")
    parser.add_argument("--max-hosts", type=int, default=256, help="Maximum host addresses to probe")
    parser.add_argument("--db", default=None, help="Path to SQLite database")

    args = parser.parse_args()
    init_db(args.db)

    cancel_event = Event()

    def handle_signal(sig, frame):
        cancel_event.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    targets = get_target_ips_for_network(args.cidr, args.max_hosts)
    total_targets = len(targets)

    # Ensure scan_session row exists
    existing = get_scan_session(args.scan_id, db_path=args.db)
    if not existing:
        from database import create_scan_session
        create_scan_session(
            network_cidr=args.cidr,
            total_addresses=total_targets,
            session_id=args.scan_id,
            db_path=args.db
        )

    # Initial start event
    start_payload = {
        "event": "start",
        "scan_id": args.scan_id,
        "cidr": args.cidr,
        "total_targets": total_targets
    }
    print(json.dumps(start_payload), flush=True)

    def on_host_scanned(host_res, checked, total, active):
        # Save to SQLite
        try:
            add_scan_result(
                session_id=args.scan_id,
                ip_address=host_res["ip_address"],
                hostname=host_res["hostname"],
                response_time_ms=host_res["response_time_ms"],
                status=host_res["status"],
                db_path=args.db
            )
            update_scan_progress(args.scan_id, checked, active, db_path=args.db)
        except Exception as e:
            sys.stderr.write(f"DB update error: {e}\n")

        # Emit realtime event
        event_payload = {
            "event": "host_result",
            "scan_id": args.scan_id,
            "host": host_res,
            "checked_addresses": checked,
            "total_addresses": total,
            "active_count": active,
            "percent": round((checked / total) * 100, 1) if total > 0 else 100
        }
        print(json.dumps(event_payload), flush=True)

    results, final_status = execute_scan(
        cidr=args.cidr,
        timeout_ms=args.timeout,
        concurrency=args.concurrency,
        max_hosts=args.max_hosts,
        cancel_event=cancel_event,
        on_host_scanned=on_host_scanned
    )

    complete_scan_session(args.scan_id, status=final_status, db_path=args.db)

    final_payload = {
        "event": "complete",
        "scan_id": args.scan_id,
        "status": final_status,
        "checked_addresses": len(results),
        "total_addresses": total_targets,
        "active_count": sum(1 for r in results if r["status"] == "Active")
    }
    print(json.dumps(final_payload), flush=True)

if __name__ == "__main__":
    main()
