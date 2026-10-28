import React, { useState } from 'react';
import { X, Copy, Check, Globe, Clock, ShieldAlert, Cpu, Activity, Info } from 'lucide-react';
import { DiscoveredHost } from '../types';

interface DeviceDetailsModalProps {
  device: DiscoveredHost | null;
  onClose: () => void;
  onCopyIpSuccess?: () => void;
}

export const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({
  device,
  onClose,
  onCopyIpSuccess,
}) => {
  const [copied, setCopied] = useState(false);

  if (!device) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(device.ip_address);
    setCopied(true);
    onCopyIpSuccess?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const getLatencyGrade = (ms: number | null) => {
    if (ms === null) return { text: 'Unresponsive', color: 'text-slate-400' };
    if (ms < 5) return { text: 'Sub-5ms (Local Loop / GigE)', color: 'text-emerald-400' };
    if (ms < 30) return { text: 'Normal LAN Latency', color: 'text-cyan-400' };
    if (ms < 100) return { text: 'Moderate Latency', color: 'text-amber-400' };
    return { text: 'High Latency / Jitter', color: 'text-rose-400' };
  };

  const latencyGrade = getLatencyGrade(device.response_time_ms);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">Host Device Inspection</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* IP and Status Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">IPv4 Address</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-mono font-bold text-slate-100 tracking-wide">
                  {device.ip_address}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                  title="Copy IP address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Status</p>
              <div className="mt-1 flex items-center gap-1.5 justify-end">
                <span
                  className={`w-2 h-2 rounded-full ${
                    device.status === 'Active' ? 'bg-emerald-400 ring-2 ring-emerald-500/20' : 'bg-slate-600'
                  }`}
                />
                <span
                  className={`text-xs font-semibold ${
                    device.status === 'Active' ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {device.status}
                </span>
              </div>
            </div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Hostname */}
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Reverse DNS Hostname</span>
              </div>
              <p className="text-xs font-mono text-slate-200 truncate">
                {device.hostname || <span className="text-slate-400 italic">No PTR record resolved</span>}
              </p>
            </div>

            {/* Latency */}
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Round-Trip Latency</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-mono font-bold text-slate-100 tabular-nums">
                  {device.response_time_ms !== null ? `${device.response_time_ms} ms` : '—'}
                </span>
              </div>
              <p className={`text-[10px] mt-0.5 ${latencyGrade.color}`}>{latencyGrade.text}</p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Scan Timestamp (UTC)
              </span>
              <span className="font-mono text-slate-300 tabular-nums">{device.scanned_at}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Local Time
              </span>
              <span className="font-mono text-slate-300 tabular-nums">
                {new Date(device.scanned_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Technical Networks Note */}
          <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-900/40 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] leading-relaxed text-slate-400">
              <p className="font-semibold text-slate-200">Computer Networks Technical Note</p>
              {device.status === 'Active' ? (
                <p>
                  Host replied with ICMP Type 0 (Echo Reply) to ICMP Type 8 (Echo Request). Response time reflects network interface transit, operating system IP stack scheduling, and cable/Wi-Fi propagation delay.
                </p>
              ) : (
                <p>
                  Host did not return an ICMP Echo Reply within the allotted timeout. In Computer Networks, a missing response may indicate either an unallocated IP address, a powered-down host, or an active firewall configured to drop ICMP packets silently (RFC 1122).
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
