import React, { useState, useEffect } from 'react';
import {
  Binary,
  Copy,
  Check,
  Info,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Hash,
} from 'lucide-react';
import { calculateSubnet, SubnetDetails } from '../utils/subnetCalculator';

interface SubnetCalculatorPageProps {
  showToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const SubnetCalculatorPage: React.FC<SubnetCalculatorPageProps> = ({ showToast }) => {
  const [inputVal, setInputVal] = useState('192.168.1.25/24');
  const [result, setResult] = useState<SubnetDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!inputVal.trim()) {
        setResult(null);
        setError(null);
        return;
      }
      const data = calculateSubnet(inputVal.trim());
      setResult(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  }, [inputVal]);

  const copyToClipboard = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    showToast('Copied', `${key}: ${val}`, 'info');
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const presets = [
    { label: 'Standard Home /24', cidr: '192.168.1.1/24' },
    { label: 'Office Class B /16', cidr: '172.16.10.1/16' },
    { label: 'Enterprise Class A /8', cidr: '10.0.0.1/8' },
    { label: 'RFC 3021 Point-to-Point /31', cidr: '10.0.0.4/31' },
    { label: 'Single Host /32', cidr: '127.0.0.1/32' },
    { label: 'Small Subnet /28', cidr: '192.168.10.32/28' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Binary className="w-4 h-4 text-cyan-400" />
            IPv4 Subnet & CIDR Calculator
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Computes network boundaries, broadcast addresses, usable host ranges, and binary masks according to RFC standards.
          </p>
        </div>
      </div>

      {/* Input Section & Presets */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
            Enter IPv4 Address with CIDR Prefix
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="e.g. 192.168.1.25/24 or 10.0.0.1/31"
                className="w-full px-4 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2">
            Quick Subnet Presets
          </span>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.cidr}
                onClick={() => setInputVal(preset.cidr)}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors font-mono"
              >
                {preset.label} <span className="text-slate-400 font-sans">({preset.cidr})</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Calculation Results */}
      {result && (
        <div className="space-y-6">
          {/* Edge Case Warning / Note if applicable */}
          {result.edgeCaseNote && (
            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-cyan-200 text-xs flex items-start gap-3">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-100">Special Subnet Specification Note</p>
                <p className="mt-0.5 text-slate-300 leading-relaxed">{result.edgeCaseNote}</p>
              </div>
            </div>
          )}

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Addresses */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Addresses</span>
              <p className="text-xl font-bold font-mono text-slate-100 tabular-nums mt-1">
                {result.totalAddresses.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">2^(32 - {result.cidr}) addresses</p>
            </div>

            {/* Usable Hosts */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Usable Host Range</span>
              <p className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
                {result.usableHosts.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Assignable node endpoints</p>
            </div>

            {/* IP Class */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Classful Category</span>
              <p className="text-xl font-bold font-mono text-cyan-400 mt-1">
                Class {result.ipClass}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Legacy IPv4 classification</p>
            </div>

            {/* Privacy Scope */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Address Scope</span>
              <p className="text-xl font-bold font-mono text-slate-100 mt-1">
                {result.isPrivate
                  ? 'Private (RFC 1918)'
                  : result.isLoopback
                  ? 'Loopback (127/8)'
                  : result.isLinkLocal
                  ? 'Link-Local (169.254/16)'
                  : 'Public (Internet)'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Routing domain designation</p>
            </div>
          </div>

          {/* Primary Subnet Parameter Details Table */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Calculated Subnet Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              {[
                { label: 'Network Address', val: result.networkAddress },
                { label: 'Broadcast Address', val: result.broadcastAddress },
                { label: 'Subnet Mask', val: result.subnetMask },
                { label: 'Wildcard Mask (Inverse)', val: result.wildcardMask },
                { label: 'CIDR Prefix Notation', val: `/${result.cidr}` },
                { label: 'First Usable Host', val: result.firstUsableAddress },
                { label: 'Last Usable Host', val: result.lastUsableAddress },
                { label: 'Input Target Host', val: result.ip },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans uppercase block">
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-slate-100">{item.val}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.label, item.val)}
                    className="p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                    title={`Copy ${item.label}`}
                  >
                    {copiedKey === item.label ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Binary Bit-Level Representation */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              32-Bit Binary Layout
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-sans text-slate-400 uppercase block mb-1">
                  IPv4 Address ({result.ip})
                </span>
                <span className="text-cyan-300 font-semibold tracking-wider text-xs">
                  {result.binaryIp}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-sans text-slate-400 uppercase block mb-1">
                  Subnet Mask ({result.subnetMask})
                </span>
                <span className="text-blue-300 font-semibold tracking-wider text-xs">
                  {result.binarySubnetMask}
                </span>
              </div>
            </div>
          </div>

          {/* Educational Concept Guide */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs text-slate-400">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Computer Networks Concepts: Subnetting & CIDR
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 leading-relaxed">
              <div>
                <p className="font-semibold text-slate-300 mb-1">Subnet Mask and Prefix</p>
                <p>
                  A subnet mask defines which portion of the 32-bit address identifies the network routing prefix and which portion designates specific host nodes on that segment. A /24 mask consists of 24 contiguous leading binary ones (255.255.255.0).
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-300 mb-1">Point-to-Point (/31) and Single Host (/32)</p>
                <p>
                  Traditional subnets reserve the first address as the Network identifier and the last address as the Directed Broadcast. Under RFC 3021, router point-to-point links using /31 conserve address space by allowing both addresses to be assigned to router interfaces. /32 represents a host route directly to a single endpoint.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
