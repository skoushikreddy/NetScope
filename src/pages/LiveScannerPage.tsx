import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Radio,
  Square,
  Search,
  Filter,
  Download,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  ArrowUpDown,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { DiscoveredHost, NetworkInterfaceInfo } from '../types';
import {
  startScanSession,
  cancelScanSession,
  detectDefaultNetwork,
  fetchInterfaces,
  getExportUrl,
} from '../services/api';

interface LiveScannerPageProps {
  onInspectDevice: (host: DiscoveredHost) => void;
  onScanCompleted?: () => void;
  showToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const LiveScannerPage: React.FC<LiveScannerPageProps> = ({
  onInspectDevice,
  onScanCompleted,
  showToast,
}) => {
  // Scanner configuration form
  const [cidr, setCidr] = useState('127.0.0.0/30');
  const [timeoutMs, setTimeoutMs] = useState(1000);
  const [concurrency, setConcurrency] = useState(10);
  const [maxHosts, setMaxHosts] = useState(256);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);

  // Active scan state
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [checkedCount, setCheckedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [scanStatus, setScanStatus] = useState<string>('idle');
  const [scanResults, setScanResults] = useState<DiscoveredHost[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Table filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unresponsive'>('all');
  const [sortField, setSortField] = useState<'ip' | 'hostname' | 'latency' | 'status'>('ip');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Load interfaces and default network on initial mount
  useEffect(() => {
    async function loadNetworkInfo() {
      try {
        const ifaces = await fetchInterfaces();
        setInterfaces(ifaces);
        if (ifaces.length > 0) {
          setSelectedInterface(ifaces[0].name);
        }
        const suggested = await detectDefaultNetwork();
        if (suggested) {
          setCidr(suggested);
        }
      } catch (err: any) {
        console.error('Initial network detection error:', err);
      }
    }
    loadNetworkInfo();
  }, []);

  // Timer effect for elapsed scan duration
  useEffect(() => {
    if (isScanning) {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isScanning]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    try {
      const suggested = await detectDefaultNetwork();
      setCidr(suggested);
      showToast('Network Detected', `Suggested target subnet: ${suggested}`, 'info');
    } catch (err: any) {
      showToast('Detection Failed', err.message, 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleInterfaceChange = (ifaceName: string) => {
    setSelectedInterface(ifaceName);
    const chosen = interfaces.find((i) => i.name === ifaceName);
    if (chosen) {
      // Suggest CIDR for this interface
      if (chosen.is_loopback) {
        setCidr('127.0.0.0/30');
      } else {
        const octets = chosen.ip.split('.');
        if (octets.length === 4) {
          setCidr(`${octets[0]}.${octets[1]}.${octets[2]}.0/24`);
        }
      }
    }
  };

  const handleStartScan = async () => {
    setErrorMessage(null);
    if (!cidr.trim()) {
      setErrorMessage('Please specify an IPv4 CIDR subnet (e.g. 192.168.1.0/24)');
      return;
    }

    try {
      setIsScanning(true);
      setScanResults([]);
      setCheckedCount(0);
      setActiveCount(0);
      setElapsedSeconds(0);
      setScanStatus('running');

      const session = await startScanSession({
        cidr: cidr.trim(),
        timeout_ms: timeoutMs,
        concurrency,
        max_hosts: maxHosts,
      });

      setCurrentScanId(session.scan_id);
      setTotalCount(session.total_addresses);
      showToast('Scan Started', `Probing ${session.total_addresses} host(s) on ${cidr}`, 'info');

      // Connect to SSE stream
      if (sseRef.current) {
        sseRef.current.close();
      }

      const eventSource = new EventSource(`/api/scans/${session.scan_id}/events`);
      sseRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event === 'host_result') {
            setScanResults((prev) => {
              const existingIndex = prev.findIndex((h) => h.ip_address === data.host.ip_address);
              if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = data.host;
                return next;
              }
              return [...prev, data.host];
            });
            setCheckedCount(data.checked_addresses);
            setActiveCount(data.active_count);
          } else if (data.event === 'complete') {
            setIsScanning(false);
            setScanStatus(data.status);
            showToast(
              data.status === 'completed' ? 'Scan Completed' : 'Scan Ended',
              `Discovered ${data.active_count} active host(s) out of ${data.total_addresses}`,
              data.status === 'completed' ? 'success' : 'info'
            );
            eventSource.close();
            onScanCompleted?.();
          }
        } catch (e) {
          console.error('SSE JSON error:', e);
        }
      };

      eventSource.onerror = () => {
        // SSE closed or finished
        setIsScanning(false);
        eventSource.close();
      };
    } catch (err: any) {
      setIsScanning(false);
      setErrorMessage(err.message || 'Failed to start scan');
      showToast('Scan Error', err.message, 'error');
    }
  };

  const handleCancelScan = async () => {
    if (!currentScanId) return;
    try {
      await cancelScanSession(currentScanId);
      setIsScanning(false);
      setScanStatus('cancelled');
      if (sseRef.current) sseRef.current.close();
      showToast('Scan Cancelled', 'Stopped further ICMP host probes', 'info');
      onScanCompleted?.();
    } catch (err: any) {
      showToast('Cancel Failed', err.message, 'error');
    }
  };

  // Filtered and sorted table records
  const filteredResults = useMemo(() => {
    return scanResults.filter((device) => {
      // Search
      const matchesSearch =
        device.ip_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (device.hostname && device.hostname.toLowerCase().includes(searchQuery.toLowerCase()));

      // Status filter
      if (statusFilter === 'active' && device.status !== 'Active') return false;
      if (statusFilter === 'unresponsive' && device.status !== 'No Response') return false;

      return matchesSearch;
    });
  }, [scanResults, searchQuery, statusFilter]);

  const sortedResults = useMemo(() => {
    return [...filteredResults].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'ip') {
        const ipToNum = (ip: string) =>
          ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
        comparison = ipToNum(a.ip_address) - ipToNum(b.ip_address);
      } else if (sortField === 'hostname') {
        comparison = (a.hostname || '').localeCompare(b.hostname || '');
      } else if (sortField === 'latency') {
        const latA = a.response_time_ms ?? 999999;
        const latB = b.response_time_ms ?? 999999;
        comparison = latA - latB;
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredResults, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedResults.length / pageSize) || 1;
  const paginatedResults = sortedResults.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleSort = (field: 'ip' | 'hostname' | 'latency' | 'status') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((checkedCount / totalCount) * 100)) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Scanner Controls Form */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Live Host Discovery Probe
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Probes target IPv4 subnets via ICMP Echo Request and resolves PTR hostnames.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoDetect}
              disabled={isScanning || isDetecting}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg border border-slate-700/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
              <span>Auto-Detect Subnet</span>
            </button>
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Target CIDR Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
              Network CIDR Range
            </label>
            <input
              type="text"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              disabled={isScanning}
              placeholder="e.g. 192.168.1.0/24 or 127.0.0.0/30"
              className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
          </div>

          {/* Interface Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
              Network Interface
            </label>
            <select
              value={selectedInterface}
              onChange={(e) => handleInterfaceChange(e.target.value)}
              disabled={isScanning}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
            >
              {interfaces.map((iface) => (
                <option key={`${iface.name}-${iface.ip}`} value={iface.name}>
                  {iface.name} ({iface.ip})
                </option>
              ))}
              {interfaces.length === 0 && (
                <option value="default">Default OS Interface</option>
              )}
            </select>
          </div>

          {/* Timeout */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Probe Timeout (ms)
              </label>
              <span className="font-mono text-cyan-400">{timeoutMs} ms</span>
            </div>
            <select
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))}
              disabled={isScanning}
              className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value={300}>300 ms (Fast LAN)</option>
              <option value={500}>500 ms (Standard)</option>
              <option value={1000}>1000 ms (Reliable)</option>
              <option value={2000}>2000 ms (High Latency/VPN)</option>
            </select>
          </div>

          {/* Concurrency Workers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Concurrency Workers
              </label>
              <span className="font-mono text-cyan-400">{concurrency} threads</span>
            </div>
            <input
              type="range"
              min="1"
              max="32"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
              disabled={isScanning}
              className="w-full accent-cyan-400 cursor-pointer mt-2"
            />
          </div>
        </div>

        {/* Error Callout */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>RFC 1918 Private & Loopback Networks Authorized</span>
          </div>

          <div className="flex items-center gap-3">
            {isScanning ? (
              <button
                onClick={handleCancelScan}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Cancel Scan</span>
              </button>
            ) : (
              <button
                onClick={handleStartScan}
                className="px-5 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 rounded-lg shadow-md shadow-cyan-400/20 transition-all flex items-center gap-2"
              >
                <Radio className="w-3.5 h-3.5 text-slate-900" />
                <span>Start Network Scan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Progress Bar & Metric Counters */}
      {(isScanning || checkedCount > 0) && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Scan Progress
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-xs font-mono text-cyan-400">{progressPercent}%</span>
              {isScanning && (
                <span className="text-[11px] text-cyan-400 font-mono animate-pulse">
                  [Probing hosts...]
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{elapsedSeconds}s elapsed</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {checkedCount} / {totalCount} hosts
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{activeCount} active</span>
              </div>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                isScanning
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                  : scanStatus === 'cancelled'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Discovered Device Results Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>Discovered Devices</span>
              <span className="text-xs font-mono text-slate-400">
                ({sortedResults.length} records)
              </span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search IP or hostname..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Status Segmented Buttons */}
            <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-slate-100 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-emerald-950/80 text-emerald-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('unresponsive')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'unresponsive'
                    ? 'bg-slate-800 text-slate-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                No Response
              </button>
            </div>

            {/* Export Dropdown / Actions */}
            {currentScanId && scanResults.length > 0 && (
              <div className="flex items-center gap-2">
                <a
                  href={getExportUrl(currentScanId, 'csv')}
                  download
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                  title="Export results to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CSV</span>
                </a>
                <a
                  href={getExportUrl(currentScanId, 'json')}
                  download
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                  title="Export results to JSON"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>JSON</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <th
                  onClick={() => toggleSort('ip')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>IP Address</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('hostname')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Hostname (Reverse DNS)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('status')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('latency')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Response Time</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {paginatedResults.length > 0 ? (
                paginatedResults.map((host, idx) => {
                  const isHighLatency =
                    host.response_time_ms !== null && host.response_time_ms > 80;
                  return (
                    <tr
                      key={host.ip_address || idx}
                      onClick={() => onInspectDevice(host)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-slate-100 flex items-center gap-2">
                        <span>{host.ip_address}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans">
                        {host.hostname ? (
                          <span className="text-cyan-300 font-mono text-xs">{host.hostname}</span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            No PTR record
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            host.status === 'Active' ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              host.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          {host.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {host.response_time_ms !== null ? (
                          <span
                            className={`font-semibold ${
                              isHighLatency ? 'text-rose-400' : 'text-slate-200'
                            }`}
                          >
                            {host.response_time_ms} ms
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectDevice(host);
                          }}
                          className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                    {isScanning ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>Sending ICMP ping requests to subnet addresses...</span>
                      </div>
                    ) : (
                      'No scan results yet. Enter a CIDR range and click "Start Network Scan" above.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-400">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedResults.length)} of {sortedResults.length} hosts
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
              >
                Previous
              </button>
              <span className="px-2 text-slate-400 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
