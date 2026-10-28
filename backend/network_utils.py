"""
Network utility functions for NetScope.
Provides interface detection, subnet validation, and IPv4 math.
"""

import ipaddress
import platform
import socket
import subprocess
import re
from typing import Dict, List, Optional, Any

def get_platform_name() -> str:
    """Returns the normalized OS platform name."""
    system = platform.system().lower()
    if 'darwin' in system:
        return 'macos'
    elif 'win' in system:
        return 'windows'
    return 'linux'

def detect_network_interfaces() -> List[Dict[str, Any]]:
    """
    Detects local IPv4 interfaces across platforms (Linux, macOS, Windows).
    Falls back gracefully if specific OS utilities are unavailable.
    """
    interfaces: List[Dict[str, Any]] = []
    seen_ips = set()

    # 1. Primary host address and loopback
    try:
        hostname = socket.gethostname()
        primary_ip = socket.gethostbyname(hostname)
        if primary_ip and primary_ip not in seen_ips:
            interfaces.append({
                "name": "Primary Interface",
                "ip": primary_ip,
                "netmask": "255.255.255.0",
                "is_loopback": primary_ip.startswith("127."),
                "is_up": True
            })
            seen_ips.add(primary_ip)
    except Exception:
        pass

    # Always ensure loopback is listed
    if "127.0.0.1" not in seen_ips:
        interfaces.append({
            "name": "lo (Loopback)",
            "ip": "127.0.0.1",
            "netmask": "255.0.0.0",
            "is_loopback": True,
            "is_up": True
        })
        seen_ips.add("127.0.0.1")

    # 2. Linux ip command parser
    if get_platform_name() == 'linux':
        try:
            res = subprocess.run(["ip", "-4", "-o", "addr", "show"], capture_output=True, text=True, timeout=3)
            if res.returncode == 0:
                for line in res.stdout.strip().split("\n"):
                    # Example: 1: lo    inet 127.0.0.1/8 scope host lo
                    # Example: 3: eth1  inet 169.254.8.1/32 scope global eth1
                    match = re.search(r'\d+:\s+(\S+)\s+inet\s+(\d+\.\d+\.\d+\.\d+)/(\d+)', line)
                    if match:
                        ifname, ip_str, prefix = match.groups()
                        if ip_str not in seen_ips:
                            net = ipaddress.IPv4Network(f"{ip_str}/{prefix}", strict=False)
                            interfaces.append({
                                "name": ifname,
                                "ip": ip_str,
                                "netmask": str(net.netmask),
                                "is_loopback": ifname.startswith("lo") or ip_str.startswith("127."),
                                "is_up": True
                            })
                            seen_ips.add(ip_str)
        except Exception:
            pass

    return interfaces

def get_default_local_network() -> str:
    """
    Suggests a safe local subnet for scanning.
    Prefers private LAN subnets if present, or safe loopback /30 for contained environments.
    """
    interfaces = detect_network_interfaces()
    for iface in interfaces:
        ip_str = iface["ip"]
        try:
            ip = ipaddress.IPv4Address(ip_str)
            if ip.is_private and not ip.is_loopback:
                # e.g., 192.168.1.100 -> 192.168.1.0/24
                net = ipaddress.IPv4Network(f"{ip_str}/24", strict=False)
                return str(net)
        except Exception:
            continue

    # Fallback to safe loopback range
    return "127.0.0.0/30"

def is_authorized_subnet(cidr_str: str) -> bool:
    """
    Validates that the CIDR range is a private or loopback range (RFC 1918 / RFC 1122),
    preventing unauthorized scanning of public IP space by default.
    """
    try:
        net = ipaddress.IPv4Network(cidr_str.strip(), strict=False)
        return net.is_private or net.is_loopback or net.is_link_local
    except Exception:
        return False

def calculate_subnet_info(cidr_str: str) -> Dict[str, Any]:
    """
    Calculates complete subnet metrics using Python's ipaddress module.
    Handles /31 (RFC 3021) and /32 edge cases.
    """
    net = ipaddress.IPv4Network(cidr_str.strip(), strict=False)
    prefix = net.prefixlen
    total_addresses = net.num_addresses

    first_octet = int(str(net.network_address).split('.')[0])
    if 1 <= first_octet <= 126:
        ip_class = 'A'
    elif 128 <= first_octet <= 191:
        ip_class = 'B'
    elif 192 <= first_octet <= 223:
        ip_class = 'C'
    elif 224 <= first_octet <= 239:
        ip_class = 'D (Multicast)'
    else:
        ip_class = 'E (Experimental)'

    edge_case_note = None
    if prefix == 32:
        usable_hosts = 1
        first_usable = str(net.network_address)
        last_usable = str(net.network_address)
        edge_case_note = "/32 represents a single host route. Network and broadcast addresses are identical."
    elif prefix == 31:
        usable_hosts = 2
        first_usable = str(net.network_address)
        last_usable = str(net.broadcast_address)
        edge_case_note = "RFC 3021 defines /31 for point-to-point links. Both addresses are assigned to host endpoints."
    elif prefix == 0:
        usable_hosts = 4294967294
        first_usable = "0.0.0.1"
        last_usable = "255.255.255.254"
        edge_case_note = "/0 represents the entire IPv4 Internet address space (default route)."
    else:
        usable_hosts = max(0, total_addresses - 2)
        first_usable = str(net.network_address + 1)
        last_usable = str(net.broadcast_address - 1)

    return {
        "ip": str(net.network_address),
        "cidr": prefix,
        "network_address": str(net.network_address),
        "broadcast_address": str(net.broadcast_address),
        "subnet_mask": str(net.netmask),
        "wildcard_mask": str(net.hostmask),
        "total_addresses": total_addresses,
        "usable_hosts": usable_hosts,
        "first_usable_address": first_usable,
        "last_usable_address": last_usable,
        "ip_class": ip_class,
        "is_private": net.is_private,
        "is_loopback": net.is_loopback,
        "is_link_local": net.is_link_local,
        "edge_case_note": edge_case_note
    }
