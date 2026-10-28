"""
Core Network Scanner module for NetScope.
Executes platform-aware ICMP pings, measures latency, resolves reverse DNS,
and coordinates concurrent host probing.
"""

import ipaddress
import platform
import re
import socket
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Event
from typing import Dict, List, Optional, Tuple, Any, Callable

def get_platform_ping_command(ip: str, timeout_ms: int) -> List[str]:
    """
    Returns platform-specific ping command arguments.
    Linux: -c 1 -W <seconds>
    macOS: -c 1 -W <milliseconds>
    Windows: -n 1 -w <milliseconds>
    """
    system = platform.system().lower()
    timeout_sec = max(1, int(round(timeout_ms / 1000.0)))

    if 'win' in system:
        return ["ping", "-n", "1", "-w", str(timeout_ms), ip]
    elif 'darwin' in system:
        return ["ping", "-c", "1", "-W", str(timeout_ms), ip]
    else:
        # Default to Linux / Unix standard
        return ["ping", "-c", "1", "-W", str(timeout_sec), ip]

def parse_ping_output(stdout: str, wall_clock_ms: float) -> Tuple[bool, Optional[float]]:
    """
    Parses ping command standard output for success and round-trip time.
    Returns (is_active, response_time_ms).
    """
    if not stdout:
        return False, None

    # Common patterns:
    # time=0.231 ms, time=12.4 ms, time=15ms, time<1ms
    time_match = re.search(r'time[=<]([0-9.]+)\s*ms', stdout, re.IGNORECASE)
    if time_match:
        try:
            return True, float(time_match.group(1))
        except ValueError:
            pass

    # Windows style: Average = 12ms or Minimum = 10ms, Maximum = 15ms, Average = 12ms
    win_match = re.search(r'Average\s*=\s*([0-9]+)ms', stdout, re.IGNORECASE)
    if win_match:
        try:
            return True, float(win_match.group(1))
        except ValueError:
            pass

    # Linux summary: rtt min/avg/max/mdev = 0.082/0.082/0.082/0.000 ms
    rtt_match = re.search(r'rtt\s+min/avg/max/\S+\s*=\s*[0-9.]+/([0-9.]+)/', stdout, re.IGNORECASE)
    if rtt_match:
        try:
            return True, float(rtt_match.group(1))
        except ValueError:
            pass

    # Success indicator without explicit time field (e.g. 1 packets received or 1 received)
    if re.search(r'(1\s+packets\s+received|1\s+received|bytes\s+from)', stdout, re.IGNORECASE):
        # Fall back to monotonic wall-clock elapsed time
        return True, round(wall_clock_ms, 2)

    return False, None

def probe_host(ip: str, timeout_ms: int = 1000) -> Dict[str, Any]:
    """
    Probes a single host via ping and attempts reverse DNS lookup.
    Never throws an unhandled exception.
    """
    cmd = get_platform_ping_command(ip, timeout_ms)
    start_time = time.monotonic()

    is_active = False
    response_time: Optional[float] = None
    hostname: Optional[str] = None

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=(timeout_ms / 1000.0) + 1.0
        )
        elapsed_ms = (time.monotonic() - start_time) * 1000.0

        if proc.returncode == 0:
            is_active, response_time = parse_ping_output(proc.stdout, elapsed_ms)
            if not is_active:
                # In case returncode 0 but regex missed, use elapsed
                is_active = True
                response_time = round(elapsed_ms, 2)

    except subprocess.TimeoutExpired:
        is_active = False
        response_time = None
    except Exception:
        is_active = False
        response_time = None

    # Reverse DNS lookup if host responded
    if is_active:
        try:
            # Set short socket timeout to avoid hanging DNS servers
            old_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(1.0)
            resolved, _, _ = socket.gethostbyaddr(ip)
            hostname = resolved if resolved and resolved != ip else None
            socket.setdefaulttimeout(old_timeout)
        except Exception:
            hostname = None

    return {
        "ip_address": ip,
        "hostname": hostname,
        "response_time_ms": response_time,
        "status": "Active" if is_active else "No Response",
        "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

def get_target_ips_for_network(cidr: str, max_hosts: int = 256) -> List[str]:
    """
    Enumerates host IP strings safely within a subnet.
    """
    net = ipaddress.IPv4Network(cidr.strip(), strict=False)
    if net.prefixlen == 32:
        return [str(net.network_address)]
    if net.prefixlen == 31:
        return [str(net.network_address), str(net.broadcast_address)]

    # Standard subnet
    hosts = []
    for host in net.hosts():
        hosts.append(str(host))
        if len(hosts) >= max_hosts:
            break
    return hosts

def execute_scan(
    cidr: str,
    timeout_ms: int = 1000,
    concurrency: int = 10,
    max_hosts: int = 256,
    cancel_event: Optional[Event] = None,
    on_host_scanned: Optional[Callable[[Dict[str, Any], int, int, int], None]] = None
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Scans the given CIDR network with bounded concurrency.
    Yields or calls on_host_scanned callback after each host is probed.
    Supports clean cancellation via threading.Event.
    """
    target_ips = get_target_ips_for_network(cidr, max_hosts)
    total_targets = len(target_ips)
    results: List[Dict[str, Any]] = []

    checked_count = 0
    active_count = 0
    final_status = "completed"

    # Enforce safe bounds
    safe_workers = max(1, min(concurrency, 32))

    with ThreadPoolExecutor(max_workers=safe_workers) as executor:
        future_to_ip = {}
        for ip in target_ips:
            if cancel_event and cancel_event.is_set():
                final_status = "cancelled"
                break
            future = executor.submit(probe_host, ip, timeout_ms)
            future_to_ip[future] = ip

        for future in as_completed(future_to_ip):
            if cancel_event and cancel_event.is_set():
                final_status = "cancelled"
                # Cancel pending futures where possible
                for f in future_to_ip:
                    f.cancel()
                break

            try:
                res = future.result()
                results.append(res)
                checked_count += 1
                if res["status"] == "Active":
                    active_count += 1

                if on_host_scanned:
                    on_host_scanned(res, checked_count, total_targets, active_count)
            except Exception:
                checked_count += 1

    return results, final_status
