import {
  ScanSession,
  DiscoveredHost,
  NetworkInterfaceInfo,
  SubnetCalculationResult,
  AnalyticsSummary,
  AnalyticsHistoryPoint,
} from '../types';

export const API_BASE = '/api';

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function fetchInterfaces(): Promise<NetworkInterfaceInfo[]> {
  const res = await fetch(`${API_BASE}/network/interfaces`);
  if (!res.ok) throw new Error('Failed to retrieve network interfaces');
  const data = await res.json();
  return data.interfaces || [];
}

export async function detectDefaultNetwork(): Promise<string> {
  const res = await fetch(`${API_BASE}/network/detect`);
  if (!res.ok) throw new Error('Failed to detect default network');
  const data = await res.json();
  return data.suggested_cidr || '127.0.0.0/30';
}

export async function calculateSubnetApi(cidr: string): Promise<SubnetCalculationResult> {
  const res = await fetch(`${API_BASE}/subnet/calculate?cidr=${encodeURIComponent(cidr)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to calculate subnet');
  return data;
}

export async function startScanSession(params: {
  cidr: string;
  timeout_ms: number;
  concurrency: number;
  max_hosts: number;
  allow_public?: boolean;
}): Promise<{ scan_id: string; total_addresses: number; status: string }> {
  const res = await fetch(`${API_BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to initiate scan session');
  return data;
}

export async function fetchScanSessions(): Promise<ScanSession[]> {
  const res = await fetch(`${API_BASE}/scans`);
  if (!res.ok) throw new Error('Failed to fetch scan sessions');
  const data = await res.json();
  return data.sessions || [];
}

export async function fetchScanResults(scanId: string): Promise<{ session: ScanSession; results: DiscoveredHost[] }> {
  const res = await fetch(`${API_BASE}/scans/${encodeURIComponent(scanId)}/results`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch scan results');
  return data;
}

export async function cancelScanSession(scanId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/scans/${encodeURIComponent(scanId)}/cancel`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cancel scan session');
  return data;
}

export async function deleteScanSession(scanId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/scans/${encodeURIComponent(scanId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete scan session');
  }
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/analytics/summary`);
  if (!res.ok) throw new Error('Failed to fetch analytics summary');
  return res.json();
}

export async function fetchAnalyticsHistory(limit = 15): Promise<AnalyticsHistoryPoint[]> {
  const res = await fetch(`${API_BASE}/analytics/history?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch analytics history');
  const data = await res.json();
  return data.history || [];
}

export function getExportUrl(scanId: string, format: 'csv' | 'json'): string {
  return `${API_BASE}/export/scans/${encodeURIComponent(scanId)}.${format}`;
}
