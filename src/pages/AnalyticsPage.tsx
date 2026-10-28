import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Activity,
  Layers,
  Clock,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import { AnalyticsSummary, AnalyticsHistoryPoint, DiscoveredHost } from '../types';
import { fetchAnalyticsHistory } from '../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

interface AnalyticsPageProps {
  summary: AnalyticsSummary | null;
  devices: DiscoveredHost[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ summary, devices }) => {
  const [history, setHistory] = useState<AnalyticsHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await fetchAnalyticsHistory(20);
        setHistory(data);
      } catch (e) {
        console.error('Failed to load analytics history:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadHistory();
  }, []);

  const hasData = history.length > 0;

  // Chart data
  const chartData = history.map((pt, idx) => ({
    name: pt.network_cidr.length > 15 ? pt.network_cidr.slice(0, 15) : pt.network_cidr,
    activeHosts: pt.active_count,
    totalChecked: pt.total_addresses,
    avgLatency: pt.avg_latency,
    date: new Date(pt.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  // Latency distribution from discovered devices
  const activeDevices = devices.filter((d) => d.status === 'Active' && d.response_time_ms !== null);
  const latencyBuckets = [
    { label: '< 1ms', count: activeDevices.filter((d) => (d.response_time_ms ?? 0) < 1).length },
    {
      label: '1-10ms',
      count: activeDevices.filter((d) => (d.response_time_ms ?? 0) >= 1 && (d.response_time_ms ?? 0) < 10).length,
    },
    {
      label: '10-50ms',
      count: activeDevices.filter((d) => (d.response_time_ms ?? 0) >= 10 && (d.response_time_ms ?? 0) < 50).length,
    },
    {
      label: '50-100ms',
      count: activeDevices.filter((d) => (d.response_time_ms ?? 0) >= 50 && (d.response_time_ms ?? 0) < 100).length,
    },
    { label: '> 100ms', count: activeDevices.filter((d) => (d.response_time_ms ?? 0) >= 100).length },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Network Scan Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Historical trends and latency performance metrics computed from persistent SQLite scan sessions.
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <Activity className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Insufficient Historical Data</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Analytics charts require at least one completed scan session. Perform a scan in the Live Scanner to populate performance charts.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dual Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Active Devices across Sessions */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Active Devices Discovered by Scan
                </h3>
                <p className="text-[11px] text-slate-400">Total targets versus responsive hosts</p>
              </div>

              <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
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
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="totalChecked" fill="#334155" name="Subnet Hosts" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="activeHosts" fill="#06b6d4" name="Active Hosts" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Average Latency progression */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Average Round-Trip Latency Trend (ms)
                </h3>
                <p className="text-[11px] text-slate-400">Mean ICMP reply latency across sessions</p>
              </div>

              <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit=" ms" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgLatency"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#0284c7' }}
                      name="Avg Latency (ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Latency Distribution Histogram */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Response Time Distribution Across All Discovered Hosts
              </h3>
              <p className="text-[11px] text-slate-400">
                Number of responsive devices categorized by ICMP latency ranges
              </p>
            </div>

            <div className="min-h-[200px]">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={latencyBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Device Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
