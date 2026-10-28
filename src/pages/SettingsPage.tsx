import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  Database,
  Terminal,
  ShieldCheck,
  Moon,
  Sun,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  showToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  showToast,
}) => {
  const [formTimeout, setFormTimeout] = useState(settings.defaultTimeoutMs);
  const [formConcurrency, setFormConcurrency] = useState(settings.defaultConcurrency);
  const [formMaxRange, setFormMaxRange] = useState(settings.maxScanRange);
  const [formTheme, setFormTheme] = useState(settings.theme);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      defaultTimeoutMs: formTimeout,
      defaultConcurrency: formConcurrency,
      maxScanRange: formMaxRange,
      theme: formTheme,
    });
    showToast('Settings Saved', 'Scanner preferences have been updated', 'success');
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            Scanner Engine Settings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure concurrency limits, probe timeouts, and safe network boundaries.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Scanning Preferences */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Scan Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Default Timeout */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Default Ping Timeout (ms)
              </label>
              <select
                value={formTimeout}
                onChange={(e) => setFormTimeout(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value={300}>300 ms (Fast local networks)</option>
                <option value={500}>500 ms (Standard LAN)</option>
                <option value={1000}>1000 ms (Recommended default)</option>
                <option value={2000}>2000 ms (High latency / Wireless)</option>
              </select>
              <p className="text-[11px] text-slate-400">Time to wait for an ICMP Echo Reply per host.</p>
            </div>

            {/* Concurrency Limit */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Default Concurrency Workers
              </label>
              <select
                value={formConcurrency}
                onChange={(e) => setFormConcurrency(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value={5}>5 threads (Low CPU)</option>
                <option value={10}>10 threads (Balanced default)</option>
                <option value={20}>20 threads (Fast)</option>
                <option value={32}>32 threads (Maximum safe)</option>
              </select>
              <p className="text-[11px] text-slate-400">Simultaneous ICMP probes running concurrently.</p>
            </div>

            {/* Max Scan Range */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Maximum Host Addresses Per Scan
              </label>
              <select
                value={formMaxRange}
                onChange={(e) => setFormMaxRange(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value={64}>64 addresses (/26 or smaller)</option>
                <option value={128}>128 addresses (/25 or smaller)</option>
                <option value={256}>256 addresses (/24 standard)</option>
                <option value={512}>512 addresses (/23)</option>
              </select>
              <p className="text-[11px] text-slate-400">Prevents inadvertent flooding of oversized subnets.</p>
            </div>

            {/* Theme */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Visual Theme
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormTheme('dark')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                    formTheme === 'dark'
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dark Slate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormTheme('light')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                    formTheme === 'light'
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">Interface color theme preference.</p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5 text-slate-900" />
              <span>Save Preferences</span>
            </button>
          </div>
        </div>

        {/* System Diagnostics & Backend Info */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            Backend Diagnostics & Environment
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans block mb-1">Scanner Engine</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Python 3.10 ICMP Ping
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans block mb-1">Database Store</span>
              <span className="text-blue-400 font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                SQLite3 (data/netscope.db)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-sans block mb-1">Safety Enforcer</span>
              <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                RFC 1918 Private Ranges
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
