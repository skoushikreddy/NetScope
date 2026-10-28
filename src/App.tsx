/**
 * NetScope — Simple Network Scanner
 * Root Application Component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ToastContainer, ToastMessage } from './components/Toast';
import { DeviceDetailsModal } from './components/DeviceDetailsModal';

import { DashboardPage } from './pages/DashboardPage';
import { LiveScannerPage } from './pages/LiveScannerPage';
import { NetworkDevicesPage } from './pages/NetworkDevicesPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { SubnetCalculatorPage } from './pages/SubnetCalculatorPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';

import {
  NavigationTab,
  AnalyticsSummary,
  ScanSession,
  DiscoveredHost,
  AppSettings,
} from './types';
import {
  fetchAnalyticsSummary,
  fetchScanSessions,
  fetchScanResults,
} from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isScanning, setIsScanning] = useState(false);
  const [inspectedDevice, setInspectedDevice] = useState<DiscoveredHost | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Application Data States
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [devices, setDevices] = useState<DiscoveredHost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // User Settings
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    defaultTimeoutMs: 1000,
    defaultConcurrency: 10,
    maxScanRange: 256,
    autoDetectOnLoad: true,
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (title: string, description?: string, type: 'success' | 'error' | 'info' = 'info') => {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      setToasts((prev) => [...prev, { id, title, description, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync theme to HTML root element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load backend summary, sessions, and devices from SQLite
  const loadData = useCallback(async () => {
    try {
      const [sumData, sessData] = await Promise.all([
        fetchAnalyticsSummary().catch(() => null),
        fetchScanSessions().catch(() => []),
      ]);

      if (sumData) setSummary(sumData);
      setSessions(sessData);

      // Aggregate discovered devices from recent sessions
      if (sessData.length > 0) {
        const resultsPromises = sessData.slice(0, 5).map((s) =>
          fetchScanResults(s.id).catch(() => ({ session: s, results: [] }))
        );
        const resolved = await Promise.all(resultsPromises);
        const allDevices: DiscoveredHost[] = [];
        const seenIps = new Set<string>();

        for (const r of resolved) {
          for (const d of r.results) {
            if (!seenIps.has(d.ip_address)) {
              seenIps.add(d.ip_address);
              allDevices.push(d);
            }
          }
        }
        setDevices(allDevices);
      }
    } catch (e) {
      console.error('Error loading initial app data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.theme) {
        setTheme(newSettings.theme);
      }
      return updated;
    });
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        isScanning={isScanning}
        activeCount={summary?.latest_active_count || 0}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onNewScanClick={() => setCurrentTab('scanner')}
          isScanning={isScanning}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Active Page Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-950/90">
          {currentTab === 'dashboard' && (
            <DashboardPage
              summary={summary}
              recentSessions={sessions}
              latestHosts={devices}
              onNavigate={(tab) => setCurrentTab(tab)}
              onInspectDevice={(d) => setInspectedDevice(d)}
              isLoading={isLoading}
            />
          )}

          {currentTab === 'scanner' && (
            <LiveScannerPage
              onInspectDevice={(d) => setInspectedDevice(d)}
              onScanCompleted={() => loadData()}
              showToast={showToast}
            />
          )}

          {currentTab === 'devices' && (
            <NetworkDevicesPage
              devices={devices}
              onInspectDevice={(d) => setInspectedDevice(d)}
              showToast={showToast}
            />
          )}

          {currentTab === 'history' && (
            <ScanHistoryPage
              sessions={sessions}
              onRefreshHistory={() => loadData()}
              onInspectDevice={(d) => setInspectedDevice(d)}
              onNavigateScanner={() => setCurrentTab('scanner')}
              showToast={showToast}
            />
          )}

          {currentTab === 'subnet' && (
            <SubnetCalculatorPage showToast={showToast} />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsPage summary={summary} devices={devices} />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              showToast={showToast}
            />
          )}

          {currentTab === 'about' && <AboutPage />}
        </main>
      </div>

      {/* Modals and Toasts */}
      <DeviceDetailsModal
        device={inspectedDevice}
        onClose={() => setInspectedDevice(null)}
        onCopyIpSuccess={() => showToast('IP Copied', 'Address copied to clipboard', 'info')}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
