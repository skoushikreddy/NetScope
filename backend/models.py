"""
Data models and type definitions for NetScope.
"""

from dataclasses import dataclass, asdict
from typing import Optional

@dataclass
class ScanSession:
    id: str
    network_cidr: str
    started_at: str
    completed_at: Optional[str]
    duration_ms: Optional[int]
    total_addresses: int
    checked_addresses: int
    active_count: int
    status: str

    def to_dict(self):
        return asdict(self)

@dataclass
class ScanResult:
    id: str
    scan_id: str
    ip_address: str
    hostname: Optional[str]
    response_time_ms: Optional[float]
    status: str
    scanned_at: str

    def to_dict(self):
        return asdict(self)
