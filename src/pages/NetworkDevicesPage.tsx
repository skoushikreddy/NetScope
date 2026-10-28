import React, { useState, useMemo } from 'react';
import {
  Server,
  Search,
  ArrowUpDown,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
} from 'lucide-react';
import { DiscoveredHost } from '../types';

interface NetworkDevicesPageProps {
  devices: DiscoveredHost[];
  onInspectDevice: (device: DiscoveredHost) => void;
  showToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const NetworkDevicesPage: React.FC<NetworkDevicesPageProps> = ({
  devices,
  onInspectDevice,
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unresponsive'>('all');
  const [latencyFilter, setLatencyFilter] = useState<'all' | 'fast' | 'moderate' | 'slow'>('all');
  const [sortField, setSortField] = useState<'ip' | 'hostname' | 'latency' | 'time'>('ip');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      const matchSearch =
        d.ip_address.toLowerCase().includes(search.toLowerCase()) ||
        (d.hostname && d.hostname.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      if (statusFilter === 'active' && d.status !== 'Active') return false;
      if (statusFilter === 'unresponsive' && d.status !== 'No Response') return false;

      if (latencyFilter === 'fast' && (d.response_time_ms === null || d.response_time_ms >= 10))
        return false;
      if (
        latencyFilter === 'moderate' &&
        (d.response_time_ms === null || d.response_time_ms < 10 || d.response_time_ms > 50)
      )
        return false;
      if (latencyFilter === 'slow' && (d.response_time_ms === null || d.response_time_ms <= 50))
        return false;

      return true;
    });
  }, [devices, search, statusFilter, latencyFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'ip') {
        const ipToNum = (ip: string) =>
          ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
        cmp = ipToNum(a.ip_address) - ipToNum(b.ip_address);
      } else if (sortField === 'hostname') {
        cmp = (a.hostname || '').localeCompare(b.hostname || '');
      } else if (sortField === 'latency') {
        const latA = a.response_time_ms ?? 999999;
        const latB = b.response_time_ms ?? 999999;
        cmp = latA - latB;
      } else if (sortField === 'time') {
        cmp = new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortField, sortAsc]);

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCsv = () => {
    if (devices.length === 0) return;
    let csv = 'IP Address,Hostname,Response Time (ms),Status,Scanned At\n';
    for (const d of sorted) {
      csv += `"${d.ip_address}","${d.hostname || 'N/A'}",${d.response_time_ms ?? 'N/A'},"${d.status}","${d.scanned_at}"\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netscope_device_inventory_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Inventory Exported', 'CSV file downloaded successfully', 'success');
  };

  const handleExportJson = () => {
    if (devices.length === 0) return;
    const blob = new Blob([JSON.stringify(sorted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netscope_device_inventory_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Inventory Exported', 'JSON file downloaded successfully', 'success');
  };

  const toggleSort = (field: 'ip' | 'hostname' | 'latency' | 'time') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Discovered Network Devices
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated inventory of all hosts discovered in previous and current scan sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={devices.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            disabled={devices.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by IP or hostname..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
          {/* Status Segmented */}
          <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Status
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

          {/* Latency Threshold Selector */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={latencyFilter}
              onChange={(e: any) => setLatencyFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="all">All Latencies</option>
              <option value="fast">&lt; 10 ms (Fast)</option>
              <option value="moderate">10 – 50 ms (Normal)</option>
              <option value="slow">&gt; 50 ms (Slow)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
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
                    <span>Hostname</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Status</th>
                <th
                  onClick={() => toggleSort('latency')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Latency</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('time')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Last Probed</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {paginated.length > 0 ? (
                paginated.map((host, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onInspectDevice(host)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-semibold text-slate-100">
                      {host.ip_address}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-sans">
                      {host.hostname ? (
                        <span className="text-cyan-300 font-mono">{host.hostname}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No PTR record</span>
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
                        <span className="font-semibold text-slate-200">
                          {host.response_time_ms} ms
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 tabular-nums">
                      {new Date(host.scanned_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectDevice(host);
                        }}
                        className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No devices match the specified search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-400">
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, sorted.length)} of {sorted.length} devices
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700"
              >
                Previous
              </button>
              <span className="px-2 text-slate-400 font-mono">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
