import React from 'react';
import {
  Server,
  Activity,
  Clock,
  Radio,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AnalyticsSummary, ScanSession, DiscoveredHost, NavigationTab } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardPageProps {
  summary: AnalyticsSummary | null;
  recentSessions: ScanSession[];
  latestHosts: DiscoveredHost[];
  onNavigate: (tab: NavigationTab) => void;
  onInspectDevice: (host: DiscoveredHost) => void;
  isLoading: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  summary,
  recentSessions,
  latestHosts,
  onNavigate,
  onInspectDevice,
  isLoading,
}) => {
  const hasData = summary && summary.total_scans > 0;

  // Chart data preparation
  const activeCount = summary?.latest_active_count || 0;
  const unresponsiveCount = summary?.latest_unresponsive_count || 0;
  const pieData = [
    { name: 'Active Devices', value: activeCount, color: '#06b6d4' },
    { name: 'No Response', value: unresponsiveCount, color: '#334155' },
  ];

  const recentSessionsData = recentSessions.slice(0, 7).reverse().map((s) => ({
    name: s.network_cidr,
    active: s.active_count,
    total: s.total_addresses,
    duration: s.duration_ms ? (s.duration_ms / 1000).toFixed(1) : 0,
  }));

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-28 bg-slate-800/40 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-800/40 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-800/40 rounded-xl" />
          <div className="h-64 bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        {/* Welcome Empty State Card */}
        <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Welcome to NetScope Network Scanner</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              No network scans have been recorded in the database yet. Launch an authorized scan on your local network to discover active hosts, measure latency, and resolve DNS records.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('scanner')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-slate-900 text-xs font-semibold shadow-md shadow-cyan-400/20 transition-all"
            >
              <Radio className="w-4 h-4" />
              <span>Start Your First Scan</span>
            </button>
          </div>
        </div>

        {/* Quick Capabilities Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-200">ICMP Host Discovery</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Real ping probes via Python backend with configurable concurrency, timeouts, and millisecond latency timers.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-200">CIDR & Subnet Engine</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Full IPv4 subnet calculator supporting /0 through /32, wildcard masks, and RFC 3021 point-to-point links.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-200">Persistent SQLite Store</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Historical scan sessions, discovered devices, and latency metrics persist across restarts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const latestSession = summary.latest_session;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">Network Overview</span>
            <span className="text-slate-400">·</span>
            <span className="text-xs font-mono text-slate-300">
              {latestSession?.network_cidr || '127.0.0.0/30'}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-100">
            {summary.latest_active_count} reachable devices discovered in latest scan
          </h2>
          <p className="text-xs text-slate-400">
            Persistent storage contains {summary.total_scans} completed scan session(s) across {summary.unique_active_hosts} unique active host(s).
          </p>
        </div>

        <button
          onClick={() => onNavigate('scanner')}
          className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm shadow-cyan-400/20 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Radio className="w-3.5 h-3.5 text-slate-900" />
          <span>Launch Scanner</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Addresses Checked */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Subnet Hosts</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
            {summary.latest_total_addresses}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">In target CIDR range</p>
        </div>

        {/* Active Hosts */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Active Hosts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {summary.latest_active_count}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">ICMP Echo Reply verified</p>
        </div>

        {/* Nonresponsive */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">No Response</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-300 tabular-nums">
            {summary.latest_unresponsive_count}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Timed out or firewalled</p>
        </div>

        {/* Average Latency */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Average RTT</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-300 tabular-nums">
            {summary.average_latency_ms} ms
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active hosts mean latency</p>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reachability Ratio Donut */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-slate-200">Host Reachability Ratio</h3>
            <p className="text-[11px] text-slate-400">Latest scan device status distribution</p>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-[180px]">
            {activeCount + unresponsiveCount > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">No data points</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-slate-400">Active ({activeCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span className="text-slate-400">No Response ({unresponsiveCount})</span>
            </div>
          </div>
        </div>

        {/* Scan Sessions Bar Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-200">Recent Scan Discovery</h3>
              <p className="text-[11px] text-slate-400">Active hosts discovered per session</p>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 min-h-[180px]">
            {recentSessionsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={recentSessionsData}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="active" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Active Hosts" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No session history yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Latest Discovered Hosts Table */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-200">Latest Discovered Hosts</h3>
            <p className="text-[11px] text-slate-400">Recently probed addresses from database</p>
          </div>
          <button
            onClick={() => onNavigate('devices')}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
          >
            <span>All Devices</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">Hostname</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Response Time</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {latestHosts.length > 0 ? (
                latestHosts.slice(0, 6).map((host, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {host.ip_address}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[180px] font-sans">
                      {host.hostname || <span className="text-slate-400 italic">No PTR record</span>}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
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
                    <td className="py-2.5 px-3 text-right text-slate-200 tabular-nums">
                      {host.response_time_ms !== null ? `${host.response_time_ms} ms` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        onClick={() => onInspectDevice(host)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400 font-sans">
                    No active hosts discovered in recent scans.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
