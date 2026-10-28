import React, { useState } from 'react';
import {
  History,
  Trash2,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  Radio,
  X,
  ArrowRight,
  GitCompare,
} from 'lucide-react';
import { ScanSession, DiscoveredHost } from '../types';
import { fetchScanResults, deleteScanSession, getExportUrl } from '../services/api';

interface ScanHistoryPageProps {
  sessions: ScanSession[];
  onRefreshHistory: () => void;
  onInspectDevice: (device: DiscoveredHost) => void;
  onNavigateScanner: () => void;
  showToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const ScanHistoryPage: React.FC<ScanHistoryPageProps> = ({
  sessions,
  onRefreshHistory,
  onInspectDevice,
  onNavigateScanner,
  showToast,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [inspectSessionData, setInspectSessionData] = useState<{
    session: ScanSession;
    results: DiscoveredHost[];
  } | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Deletion modal state
  const [sessionToDelete, setSessionToDelete] = useState<ScanSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compare mode state
  const [compareSessions, setCompareSessions] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareData, setCompareData] = useState<{
    s1: { session: ScanSession; results: DiscoveredHost[] };
    s2: { session: ScanSession; results: DiscoveredHost[] };
  } | null>(null);

  const handleInspectSession = async (session: ScanSession) => {
    setSelectedSessionId(session.id);
    setIsLoadingSession(true);
    try {
      const data = await fetchScanResults(session.id);
      setInspectSessionData(data);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteScanSession(sessionToDelete.id);
      showToast('Session Deleted', `Deleted scan session ${sessionToDelete.network_cidr}`, 'success');
      setSessionToDelete(null);
      if (selectedSessionId === sessionToDelete.id) {
        setInspectSessionData(null);
        setSelectedSessionId(null);
      }
      onRefreshHistory();
    } catch (err: any) {
      showToast('Delete Failed', err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleCompareSelect = (sessionId: string) => {
    setCompareSessions((prev) => {
      if (prev.includes(sessionId)) {
        return prev.filter((id) => id !== sessionId);
      }
      if (prev.length >= 2) {
        return [prev[1], sessionId];
      }
      return [...prev, sessionId];
    });
  };

  const handleOpenCompare = async () => {
    if (compareSessions.length !== 2) return;
    try {
      const [d1, d2] = await Promise.all([
        fetchScanResults(compareSessions[0]),
        fetchScanResults(compareSessions[1]),
      ]);
      setCompareData({ s1: d1, s2: d2 });
      setCompareModalOpen(true);
    } catch (err: any) {
      showToast('Comparison Failed', err.message, 'error');
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <History className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-200">No Historical Scan Sessions</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          All network discovery scans you execute are automatically archived in the local SQLite database.
        </p>
        <button
          onClick={onNavigateScanner}
          className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm transition-colors"
        >
          Start Your First Scan
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            Scan Session Archive
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Preserved historical scan sessions and host reachability records from SQLite.
          </p>
        </div>

        {compareSessions.length === 2 && (
          <button
            onClick={handleOpenCompare}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare 2 Selected Sessions</span>
          </button>
        )}
      </div>

      {/* Sessions Grid / Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3 w-8">Compare</th>
                <th className="py-2.5 px-3">Network CIDR</th>
                <th className="py-2.5 px-3">Started At</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Addresses Checked</th>
                <th className="py-2.5 px-3">Active Hosts</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {sessions.map((s) => {
                const isSelected = selectedSessionId === s.id;
                const isCompared = compareSessions.includes(s.id);
                return (
                  <tr
                    key={s.id}
                    onClick={() => handleInspectSession(s)}
                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-950/20 border-l-2 border-cyan-400' : ''
                    }`}
                  >
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => toggleCompareSelect(s.id)}
                        className="rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-0 cursor-pointer"
                        title="Select up to 2 sessions to compare"
                      />
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-100">{s.network_cidr}</td>
                    <td className="py-3 px-3 text-slate-400 tabular-nums">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-slate-300 tabular-nums">
                      {s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-300 tabular-nums">
                      {s.checked_addresses} / {s.total_addresses}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold tabular-nums">
                      {s.active_count} active
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          s.status === 'completed'
                            ? 'text-emerald-400'
                            : s.status === 'running'
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.status === 'completed'
                              ? 'bg-emerald-400'
                              : s.status === 'running'
                              ? 'bg-cyan-400 animate-pulse'
                              : 'bg-amber-400'
                          }`}
                        />
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-sans" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleInspectSession(s)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                          title="View session devices"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={getExportUrl(s.id, 'csv')}
                          download
                          className="p-1 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Export CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => setSessionToDelete(s)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Session Device Inspection Pane */}
      {inspectSessionData && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Session Inspection:</span>
                <span className="font-mono text-cyan-400">
                  {inspectSessionData.session.network_cidr}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {inspectSessionData.results.length} host records archived on{' '}
                {new Date(inspectSessionData.session.started_at).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => setInspectSessionData(null)}
              className="p-1 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2 px-3">IP Address</th>
                  <th className="py-2 px-3">Hostname</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Latency</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {inspectSessionData.results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-100">{r.ip_address}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">
                      {r.hostname ? (
                        <span className="text-cyan-300 font-mono">{r.hostname}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No PTR record</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${
                          r.status === 'Active' ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            r.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {r.response_time_ms !== null ? `${r.response_time_ms} ms` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        onClick={() => onInspectDevice(r)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Delete Scan History Entry</h3>
                <p className="text-xs text-slate-400">This action permanently deletes results from SQLite.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              Are you sure you want to delete session <span className="font-mono font-bold text-cyan-300">{sessionToDelete.network_cidr}</span> recorded on {new Date(sessionToDelete.started_at).toLocaleString()}?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSessionToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Sessions Modal */}
      {compareModalOpen && compareData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">Scan Session Comparison</h3>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Header metrics comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="text-xs font-mono font-bold text-cyan-400">
                    Session 1: {compareData.s1.session.network_cidr}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {new Date(compareData.s1.session.started_at).toLocaleString()}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Active Hosts</span>
                      <p className="text-emerald-400 font-bold font-mono">
                        {compareData.s1.session.active_count}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Duration</span>
                      <p className="text-slate-200 font-mono">
                        {compareData.s1.session.duration_ms
                          ? `${(compareData.s1.session.duration_ms / 1000).toFixed(1)}s`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="text-xs font-mono font-bold text-blue-400">
                    Session 2: {compareData.s2.session.network_cidr}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {new Date(compareData.s2.session.started_at).toLocaleString()}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Active Hosts</span>
                      <p className="text-emerald-400 font-bold font-mono">
                        {compareData.s2.session.active_count}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase">Duration</span>
                      <p className="text-slate-200 font-mono">
                        {compareData.s2.session.duration_ms
                          ? `${(compareData.s2.session.duration_ms / 1000).toFixed(1)}s`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Host Comparison Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-200 mb-2">Host Delta Analysis</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 text-[11px] uppercase font-semibold">
                        <th className="py-2 px-3">IP Address</th>
                        <th className="py-2 px-3">Session 1 Status</th>
                        <th className="py-2 px-3">Session 2 Status</th>
                        <th className="py-2 px-3 text-right">Latency Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {Array.from(
                        new Set([
                          ...compareData.s1.results.map((r) => r.ip_address),
                          ...compareData.s2.results.map((r) => r.ip_address),
                        ])
                      ).map((ip) => {
                        const h1 = compareData.s1.results.find((r) => r.ip_address === ip);
                        const h2 = compareData.s2.results.find((r) => r.ip_address === ip);
                        const lat1 = h1?.response_time_ms;
                        const lat2 = h2?.response_time_ms;
                        const delta =
                          lat1 !== undefined && lat1 !== null && lat2 !== undefined && lat2 !== null
                            ? (lat2 - lat1).toFixed(2)
                            : null;

                        return (
                          <tr key={ip} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-slate-200">{ip}</td>
                            <td className="py-2 px-3 font-sans">
                              {h1 ? (
                                <span className={h1.status === 'Active' ? 'text-emerald-400' : 'text-slate-400'}>
                                  {h1.status} ({lat1 !== null ? `${lat1}ms` : '—'})
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Not in scan</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-sans">
                              {h2 ? (
                                <span className={h2.status === 'Active' ? 'text-emerald-400' : 'text-slate-400'}>
                                  {h2.status} ({lat2 !== null ? `${lat2}ms` : '—'})
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Not in scan</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {delta !== null ? (
                                <span className={parseFloat(delta) > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                  {parseFloat(delta) > 0 ? `+${delta} ms` : `${delta} ms`}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
              <button
                onClick={() => setCompareModalOpen(false)}
                className="px-4 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
