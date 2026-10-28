"""
SQLite Database access layer for NetScope.
Manages scan sessions, discovered devices, and analytics queries.
"""

import sqlite3
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "netscope.db")

def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Returns a connection with foreign keys enabled and row dictionary factory."""
    path = db_path or DEFAULT_DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path: Optional[str] = None) -> None:
    """Creates the SQLite tables and indexes if they do not exist."""
    with get_db_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scan_sessions (
                id TEXT PRIMARY KEY,
                network_cidr TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                duration_ms INTEGER,
                total_addresses INTEGER NOT NULL,
                checked_addresses INTEGER NOT NULL DEFAULT 0,
                active_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL
            );
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS scan_results (
                id TEXT PRIMARY KEY,
                scan_id TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                hostname TEXT,
                response_time_ms REAL,
                status TEXT NOT NULL,
                scanned_at TEXT NOT NULL,
                FOREIGN KEY (scan_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
            );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scan_results_ip ON scan_results(ip_address);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_scan_sessions_started_at ON scan_sessions(started_at DESC);")
        conn.commit()

def create_scan_session(
    network_cidr: str,
    total_addresses: int,
    session_id: Optional[str] = None,
    db_path: Optional[str] = None
) -> str:
    sid = session_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO scan_sessions (id, network_cidr, started_at, total_addresses, checked_addresses, active_count, status)
            VALUES (?, ?, ?, ?, 0, 0, 'running')
            """,
            (sid, network_cidr, now, total_addresses)
        )
        conn.commit()
    return sid

def update_scan_progress(
    session_id: str,
    checked_addresses: int,
    active_count: int,
    db_path: Optional[str] = None
) -> None:
    with get_db_connection(db_path) as conn:
        conn.execute(
            """
            UPDATE scan_sessions
            SET checked_addresses = ?, active_count = ?
            WHERE id = ?
            """,
            (checked_addresses, active_count, session_id)
        )
        conn.commit()

def add_scan_result(
    session_id: str,
    ip_address: str,
    hostname: Optional[str],
    response_time_ms: Optional[float],
    status: str,
    db_path: Optional[str] = None
) -> str:
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO scan_results (id, scan_id, ip_address, hostname, response_time_ms, status, scanned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (rid, session_id, ip_address, hostname, response_time_ms, status, now)
        )
        conn.commit()
    return rid

def complete_scan_session(
    session_id: str,
    status: str = 'completed',
    db_path: Optional[str] = None
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection(db_path) as conn:
        row = conn.execute("SELECT started_at FROM scan_sessions WHERE id = ?", (session_id,)).fetchone()
        duration_ms = 0
        if row and row["started_at"]:
            try:
                start_dt = datetime.fromisoformat(row["started_at"])
                end_dt = datetime.fromisoformat(now)
                duration_ms = int((end_dt - start_dt).total_seconds() * 1000)
            except Exception:
                duration_ms = 0

        conn.execute(
            """
            UPDATE scan_sessions
            SET status = ?, completed_at = ?, duration_ms = ?
            WHERE id = ?
            """,
            (status, now, duration_ms, session_id)
        )
        conn.commit()

def get_scan_session(session_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM scan_sessions WHERE id = ?", (session_id,)).fetchone()
        return dict(row) if row else None

def list_scan_sessions(limit: int = 50, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM scan_sessions ORDER BY started_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

def get_scan_results(session_id: str, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM scan_results WHERE scan_id = ? ORDER BY ip_address ASC",
            (session_id,)
        ).fetchall()
        return [dict(r) for r in rows]

def delete_scan_session(session_id: str, db_path: Optional[str] = None) -> bool:
    with get_db_connection(db_path) as conn:
        cur = conn.execute("DELETE FROM scan_sessions WHERE id = ?", (session_id,))
        conn.commit()
        return cur.rowcount > 0

def get_analytics_summary(db_path: Optional[str] = None) -> Dict[str, Any]:
    with get_db_connection(db_path) as conn:
        latest = conn.execute("SELECT * FROM scan_sessions ORDER BY started_at DESC LIMIT 1").fetchone()
        total_scans = conn.execute("SELECT COUNT(*) as c FROM scan_sessions").fetchone()["c"]
        total_active_discovered = conn.execute(
            "SELECT COUNT(DISTINCT ip_address) as c FROM scan_results WHERE status = 'Active'"
        ).fetchone()["c"]

        avg_latency_row = conn.execute(
            "SELECT AVG(response_time_ms) as avg_lat FROM scan_results WHERE status = 'Active' AND response_time_ms IS NOT NULL"
        ).fetchone()
        avg_latency = round(avg_latency_row["avg_lat"], 2) if avg_latency_row and avg_latency_row["avg_lat"] else 0.0

        latest_active = latest["active_count"] if latest else 0
        latest_total = latest["total_addresses"] if latest else 0
        latest_unresponsive = max(0, (latest["checked_addresses"] if latest else 0) - latest_active)

        return {
            "total_scans": total_scans,
            "unique_active_hosts": total_active_discovered,
            "average_latency_ms": avg_latency,
            "latest_session": dict(latest) if latest else None,
            "latest_active_count": latest_active,
            "latest_total_addresses": latest_total,
            "latest_unresponsive_count": latest_unresponsive,
        }

def get_analytics_history(limit: int = 15, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection(db_path) as conn:
        sessions = conn.execute(
            """
            SELECT s.id, s.network_cidr, s.started_at, s.duration_ms, s.total_addresses, s.active_count,
                   (SELECT AVG(response_time_ms) FROM scan_results WHERE scan_id = s.id AND status = 'Active') as avg_latency
            FROM scan_sessions s
            WHERE s.status IN ('completed', 'cancelled')
            ORDER BY s.started_at ASC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()

        history = []
        for s in sessions:
            history.append({
                "id": s["id"],
                "network_cidr": s["network_cidr"],
                "started_at": s["started_at"],
                "duration_ms": s["duration_ms"] or 0,
                "total_addresses": s["total_addresses"],
                "active_count": s["active_count"],
                "avg_latency": round(s["avg_latency"], 2) if s["avg_latency"] else 0.0
            })
        return history
