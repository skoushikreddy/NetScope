"""
Automated unit tests for NetScope Python backend modules.
Validates subnet math, edge cases, ping output parsing, and SQLite persistence.
"""

import os
import unittest
import tempfile
import sys

# Ensure backend can be imported
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from network_utils import calculate_subnet_info, is_authorized_subnet, detect_network_interfaces
from scanner import parse_ping_output, get_target_ips_for_network
import database

class TestNetScopeBackend(unittest.TestCase):

    def test_subnet_calculation_standard(self):
        info = calculate_subnet_info("192.168.1.0/24")
        self.assertEqual(info["network_address"], "192.168.1.0")
        self.assertEqual(info["broadcast_address"], "192.168.1.255")
        self.assertEqual(info["subnet_mask"], "255.255.255.0")
        self.assertEqual(info["total_addresses"], 256)
        self.assertEqual(info["usable_hosts"], 254)
        self.assertEqual(info["first_usable_address"], "192.168.1.1")
        self.assertEqual(info["last_usable_address"], "192.168.1.254")
        self.assertEqual(info["ip_class"], "C")
        self.assertTrue(info["is_private"])

    def test_subnet_edge_case_31(self):
        info = calculate_subnet_info("10.0.0.0/31")
        self.assertEqual(info["total_addresses"], 2)
        self.assertEqual(info["usable_hosts"], 2)
        self.assertEqual(info["first_usable_address"], "10.0.0.0")
        self.assertEqual(info["last_usable_address"], "10.0.0.1")
        self.assertIn("RFC 3021", info["edge_case_note"])

    def test_subnet_edge_case_32(self):
        info = calculate_subnet_info("127.0.0.1/32")
        self.assertEqual(info["total_addresses"], 1)
        self.assertEqual(info["usable_hosts"], 1)
        self.assertEqual(info["first_usable_address"], "127.0.0.1")
        self.assertEqual(info["last_usable_address"], "127.0.0.1")
        self.assertTrue(info["is_loopback"])

    def test_authorized_subnet_detection(self):
        self.assertTrue(is_authorized_subnet("192.168.1.0/24"))
        self.assertTrue(is_authorized_subnet("10.0.0.0/8"))
        self.assertTrue(is_authorized_subnet("172.16.0.0/12"))
        self.assertTrue(is_authorized_subnet("127.0.0.0/8"))
        # Public ranges must return False for safety
        self.assertFalse(is_authorized_subnet("8.8.8.0/24"))
        self.assertFalse(is_authorized_subnet("1.1.1.0/24"))

    def test_target_ips_enumeration(self):
        ips = get_target_ips_for_network("192.168.1.0/30", max_hosts=10)
        self.assertEqual(ips, ["192.168.1.1", "192.168.1.2"])

        p2p_ips = get_target_ips_for_network("10.0.0.0/31", max_hosts=10)
        self.assertEqual(p2p_ips, ["10.0.0.0", "10.0.0.1"])

    def test_ping_output_parsing(self):
        linux_out = "64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.234 ms\n1 packets transmitted, 1 received"
        active, rtt = parse_ping_output(linux_out, 1.5)
        self.assertTrue(active)
        self.assertEqual(rtt, 0.234)

        win_out = "Reply from 192.168.1.1: bytes=32 time=14ms TTL=64\nMinimum = 14ms, Maximum = 14ms, Average = 14ms"
        active_win, rtt_win = parse_ping_output(win_out, 15.0)
        self.assertTrue(active_win)
        self.assertEqual(rtt_win, 14.0)

        unreachable_out = "From 192.168.1.10 icmp_seq=1 Destination Host Unreachable\n100% packet loss"
        active_fail, rtt_fail = parse_ping_output(unreachable_out, 1000.0)
        self.assertFalse(active_fail)
        self.assertIsNone(rtt_fail)

    def test_database_lifecycle(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            database.init_db(tmp_path)
            sid = database.create_scan_session("192.168.1.0/30", total_addresses=2, db_path=tmp_path)
            self.assertIsNotNone(sid)

            database.add_scan_result(sid, "192.168.1.1", "router.local", 1.25, "Active", db_path=tmp_path)
            database.add_scan_result(sid, "192.168.1.2", None, None, "No Response", db_path=tmp_path)
            database.update_scan_progress(sid, checked_addresses=2, active_count=1, db_path=tmp_path)
            database.complete_scan_session(sid, status="completed", db_path=tmp_path)

            session = database.get_scan_session(sid, db_path=tmp_path)
            self.assertEqual(session["status"], "completed")
            self.assertEqual(session["active_count"], 1)

            results = database.get_scan_results(sid, db_path=tmp_path)
            self.assertEqual(len(results), 2)

            analytics = database.get_analytics_summary(db_path=tmp_path)
            self.assertEqual(analytics["total_scans"], 1)
            self.assertEqual(analytics["unique_active_hosts"], 1)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

if __name__ == "__main__":
    unittest.main()
