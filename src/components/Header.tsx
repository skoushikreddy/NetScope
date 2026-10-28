import React from 'react';
import { Sun, Moon, Radio, ChevronRight, Activity, Menu } from 'lucide-react';
import { NavigationTab } from '../types';

interface HeaderProps {
  currentTab: NavigationTab;
  onNewScanClick: () => void;
  isScanning: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenMobileSidebar: () => void;
}

const TAB_TITLES: Record<NavigationTab, string> = {
  dashboard: 'Dashboard Overview',
  scanner: 'Live Network Scanner',
  devices: 'Discovered Devices',
  history: 'Scan History & Logs',
  subnet: 'IPv4 Subnet Calculator',
  analytics: 'Metrics & Analytics',
  settings: 'Scanner Settings',
  about: 'Project Architecture & Docs',
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNewScanClick,
  isScanning,
  theme,
  onToggleTheme,
  onOpenMobileSidebar,
}) => {
  return (
    <header className="h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
      {/* Zone 1: Breadcrumb Trail & Mobile Hamburger */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-medium min-w-0">
          <span className="text-slate-400 whitespace-nowrap hidden sm:inline">NetScope</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:inline" />
          <span className="text-slate-200 font-semibold truncate">
            {TAB_TITLES[currentTab] || 'Console'}
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation & Status Affordances */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live scanning badge */}
        {isScanning ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span className="whitespace-nowrap hidden sm:inline">Probe Active</span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="whitespace-nowrap">Scanner Ready</span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-700/60"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>

        {/* Primary Action Button */}
        <button
          onClick={onNewScanClick}
          className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 rounded-lg shadow-sm shadow-cyan-400/20 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <Radio className="w-3.5 h-3.5 text-slate-900" />
          <span>New Scan</span>
        </button>
      </div>
    </header>
  );
};
