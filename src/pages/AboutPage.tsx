import React from 'react';
import {
  Info,
  ShieldCheck,
  Server,
  Terminal,
  Activity,
  Layers,
  Globe,
  Radio,
  Binary,
  Cpu,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
          <Info className="w-4 h-4" />
          <span>Computer Networks Project Documentation</span>
        </div>
        <h2 className="text-xl font-bold text-slate-100">
          NetScope — Simple Network Scanner
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          NetScope is a full-stack network inventory and host discovery utility designed for Computer Networks engineering analysis. It conducts authorized ICMP ping probes across IPv4 CIDR blocks, computes round-trip latency, attempts reverse DNS resolution, and maintains an auditable session log in SQLite.
        </p>
      </div>

      {/* Computer Networks Core Concepts */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          Computer Networks Concepts Demonstrated
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-400">
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-cyan-400" />
              1. IPv4 Addressing & CIDR
            </h4>
            <p>
              IPv4 uses 32-bit addresses formatted as 4 dotted-decimal octets (e.g. 192.168.1.1). Classless Inter-Domain Routing (CIDR) replaces rigid classful boundaries with variable prefix lengths (/0 to /32), segregating network routing prefixes from host identifiers.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              2. ICMP & Ping (RFC 792)
            </h4>
            <p>
              The Internet Control Message Protocol (ICMP) operates at the Network Layer. A host probe transmits an ICMP Type 8 (Echo Request). If reachable and unblocked, the target replies with an ICMP Type 0 (Echo Reply), validating bidirectional network path integrity.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              3. Reverse DNS Resolution (PTR)
            </h4>
            <p>
              Domain Name System reverse lookups map an IP back to a canonical hostname using special in-addr.arpa domain trees. NetScope performs non-blocking reverse lookups via socket.gethostbyaddr() to discover host device labels without stalling scans.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              4. Response Time & Latency
            </h4>
            <p>
              Round-trip time (RTT) quantifies the cumulative transit duration across physical medium propagation, serialization, queueing at intermediate switches/routers, and target kernel IP stack packet processing.
            </p>
          </div>
        </div>
      </div>

      {/* System Architecture */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          System Architecture & Execution Pipeline
        </h3>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto">
          <pre>{`+------------------------------------------------------------------------+
|                      React 19 Frontend Web Console                      |
|  (Live Scanner UI, Subnet Calculator, Analytics Charts, Device Table)  |
+-----------------------------------+------------------------------------+
                                    | REST API & Server-Sent Events (SSE)
                                    v
+------------------------------------------------------------------------+
|                   Full-Stack Service (Port 3000)                       |
|   - Express API Endpoints & SSE Connection Multiplexer                 |
|   - Subnet Mathematical Validation & CIDR Range Safety Guard           |
+-----------------------------------+------------------------------------+
                                    | Process Spawning / Worker Threads
                                    v
+------------------------------------------------------------------------+
|                     Python 3 Backend Engine                            |
|   - scanner.py: Concurrent ThreadPoolExecutor                          |
|   - Subprocess OS Ping (/usr/bin/ping with platform flags)             |
|   - Socket Reverse DNS: socket.gethostbyaddr(ip)                       |
+------------------+--------------------------------+--------------------+
                   |                                |
                   v                                v
+----------------------------------+  +----------------------------------+
|      Local Network Subnet        |  |     SQLite Database Storage      |
|  (ICMP Echo Requests & Replies)  |  |   (scan_sessions, scan_results)  |
+----------------------------------+  +----------------------------------+`}</pre>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Technology Stack
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-cyan-400">Frontend</span>
            <p className="font-semibold text-slate-200">React 19 + TypeScript + Vite</p>
            <p className="text-slate-400 text-[11px]">Tailwind CSS, Lucide React, Recharts</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-blue-400">Backend</span>
            <p className="font-semibold text-slate-200">Python 3.10+ & Flask / Express</p>
            <p className="text-slate-400 text-[11px]">Subprocess Ping, Sockets, ThreadPool</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-emerald-400">Data Storage</span>
            <p className="font-semibold text-slate-200">SQLite 3 Relational Database</p>
            <p className="text-slate-400 text-[11px]">Cascading FKs, Indexes, JSON/CSV exports</p>
          </div>
        </div>
      </div>

      {/* Features, Limitations & Network Realities */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3 text-xs text-slate-400 leading-relaxed">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
          Network Realities & Practical Limitations
        </h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <strong className="text-slate-200">Browser ICMP Constraints:</strong> Modern web browsers enforce a strict security sandbox preventing arbitrary raw socket creation. Actual ICMP packets cannot be dispatched from client-side JavaScript; all real probes must execute via the host backend.
          </li>
          <li>
            <strong className="text-slate-200">Unresponsive vs Offline:</strong> A nonresponsive address does not prove a device is disconnected or powered down. Many modern firewalls and operating systems (e.g. Windows Defender Firewall) discard ICMP Echo Requests by default (stealth mode) to mitigate reconnaissance.
          </li>
          <li>
            <strong className="text-slate-200">Reverse DNS Reliability:</strong> Reverse DNS lookups depend entirely on configured PTR records in local DNS resolvers or /etc/hosts. Absence of a hostname does not impair ICMP reachability.
          </li>
        </ul>
      </div>

      {/* Ethical Scanning Policy */}
      <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Ethical Network Scanning & Safety Policy</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          NetScope is configured strictly for authorized administrative audits and academic learning. By default, the scanning engine validates target CIDRs against RFC 1918 private address space (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) and local loopback (127.0.0.0/8), preventing unsolicited probes across public Internet infrastructure.
        </p>
      </div>
    </div>
  );
};
