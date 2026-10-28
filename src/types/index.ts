export type DeviceStatus = 'Active' | 'No Response';
export type ScanSessionStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface ScanSession {
  id: string;
  network_cidr: string;
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  total_addresses: number;
  checked_addresses: number;
  active_count: number;
  status: ScanSessionStatus;
}

export interface DiscoveredHost {
  id?: string;
  scan_id?: string;
  ip_address: string;
  hostname: string | null;
  response_time_ms: number | null;
  status: DeviceStatus;
  scanned_at: string;
}

export interface NetworkInterfaceInfo {
  name: string;
  ip: string;
  netmask: string;
  is_loopback: boolean;
  is_up: boolean;
}

export interface SubnetCalculationResult {
  ip: string;
  cidr: number;
  network_address: string;
  broadcast_address: string;
  subnet_mask: string;
  wildcard_mask: string;
  total_addresses: number;
  usable_hosts: number;
  first_usable_address: string;
  last_usable_address: string;
  ip_class: 'A' | 'B' | 'C' | 'D (Multicast)' | 'E (Experimental)';
  is_private: boolean;
  is_loopback: boolean;
  is_link_local: boolean;
  binary_subnet_mask: string;
  binary_ip: string;
  edge_case_note?: string;
}

export interface AnalyticsSummary {
  total_scans: number;
  unique_active_hosts: number;
  average_latency_ms: number;
  latest_session: ScanSession | null;
  latest_active_count: number;
  latest_total_addresses: number;
  latest_unresponsive_count: number;
}

export interface AnalyticsHistoryPoint {
  id: string;
  network_cidr: string;
  started_at: string;
  duration_ms: number;
  total_addresses: number;
  active_count: number;
  avg_latency: number;
}

export type NavigationTab =
  | 'dashboard'
  | 'scanner'
  | 'devices'
  | 'history'
  | 'subnet'
  | 'analytics'
  | 'settings'
  | 'about';

export interface AppSettings {
  theme: 'dark' | 'light';
  defaultTimeoutMs: number;
  defaultConcurrency: number;
  maxScanRange: number;
  autoDetectOnLoad: boolean;
}
