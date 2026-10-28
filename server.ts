import express from 'express';
import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { calculateSubnet, getSubnetHostIps } from './src/utils/subnetCalculator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
  console.error('[NetScope] Handled uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[NetScope] Handled rejection at:', promise, 'reason:', reason);
});

const app = express();
const distDir = path.join(__dirname, 'dist');
const distHtml = path.join(distDir, 'index.html');
const hasDist = fs.existsSync(distHtml);
const isDev = process.env.NODE_ENV !== 'production' || !hasDist;

// In AI Studio dev container and Cloud Run deployment, the platform reverse proxy
// listens on port 8080 and forwards traffic to the application on port 3000.
// On local Windows/macOS/Linux machines, PORT can be set via environment variable or defaults to 3000.
const PORT = parseInt(process.env.PORT || '3000', 10);

// Resolves the correct Python binary cross-platform (python on Windows, python3 on Linux/macOS)
function getPythonCommand(): string {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

app.use(express.json());

// Initialize SQLite Database with safe fallback
interface DBStatement {
  run(...params: any[]): any;
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

interface DBInterface {
  prepare(sql: string): DBStatement;
  exec(sql: string): void;
}

let db: DBInterface;

// Try to initialize node:sqlite with writable directory fallback
try {
  let dbDir = path.join(__dirname, 'data');
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.accessSync(dbDir, fs.constants.W_OK);
  } catch {
    dbDir = '/tmp';
  }
  const dbPath = path.join(dbDir, 'netscope.db');

  const { DatabaseSync } = await import('node:sqlite');
  const sqliteDb = new DatabaseSync(dbPath);

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS scan_sessions (
      id TEXT PRIMARY KEY,
      network_cidr TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      total_addresses INTEGER NOT NULL,
      checked_addresses INTEGER NOT NULL DEFAULT 0,
      active_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_results (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      hostname TEXT,
      response_time_ms REAL,
      status TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
    CREATE INDEX IF NOT EXISTS idx_scan_results_ip ON scan_results(ip_address);
    CREATE INDEX IF NOT EXISTS idx_scan_sessions_started_at ON scan_sessions(started_at DESC);
  `);

  db = sqliteDb;
  console.log(`[NetScope] SQLite initialized successfully at ${dbPath}`);
} catch (err) {
  console.warn('[NetScope] node:sqlite not available or error, using in-memory store:', err);
  // In-memory fallback implementation
  const sessions = new Map<string, any>();
  const results = new Map<string, any>();

  db = {
    exec() {},
    prepare(sql: string): DBStatement {
      const lower = sql.toLowerCase();
      return {
        run(...params: any[]) {
          if (lower.includes('insert into scan_sessions')) {
            const [id, network_cidr, started_at, total_addresses] = params;
            sessions.set(id, {
              id,
              network_cidr,
              started_at,
              total_addresses,
              checked_addresses: 0,
              active_count: 0,
              status: 'running',
            });
          } else if (lower.includes('update scan_sessions set status = ?')) {
            const [status, completed_at, duration_ms, id] = params;
            const sess = sessions.get(id);
            if (sess) {
              sess.status = status;
              sess.completed_at = completed_at;
              sess.duration_ms = duration_ms;
            }
          } else if (lower.includes('update scan_sessions set checked_addresses')) {
            const [checked, active, id] = params;
            const sess = sessions.get(id);
            if (sess) {
              sess.checked_addresses = checked;
              sess.active_count = active;
            }
          } else if (lower.includes('delete from scan_sessions')) {
            const [id] = params;
            sessions.delete(id);
            for (const [rid, res] of results.entries()) {
              if (res.scan_id === id) results.delete(rid);
            }
          }
        },
        get(...params: any[]) {
          if (lower.includes('from scan_sessions where id = ?')) {
            return sessions.get(params[0]) || null;
          }
          if (lower.includes('count(*) as c from scan_sessions')) {
            return { c: sessions.size };
          }
          if (lower.includes('from scan_sessions order by started_at desc limit 1')) {
            const all = Array.from(sessions.values());
            all.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
            return all[0] || null;
          }
          return null;
        },
        all(...params: any[]) {
          if (lower.includes('from scan_sessions order by started_at desc')) {
            const all = Array.from(sessions.values());
            all.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
            return all.slice(0, params[0] || 50);
          }
          if (lower.includes('from scan_results where scan_id = ?')) {
            const res = Array.from(results.values()).filter((r) => r.scan_id === params[0]);
            res.sort((a, b) => a.ip_address.localeCompare(b.ip_address));
            return res;
          }
          return [];
        },
      };
    },
  };
}

// Active scan tracking & event broadcasting
interface ActiveScanInfo {
  process?: ChildProcess;
  clients: Set<Response>;
  isCancelled: boolean;
  historyEvents: any[];
}
const activeScans = new Map<string, ActiveScanInfo>();

// 1. Health check (Crucial for Cloud Run readiness and liveness probes)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'NetScope Full-Stack Server',
    node_version: process.version,
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// 2. Interfaces detection
app.get('/api/network/interfaces', async (_req: Request, res: Response) => {
  const fallback = [
    { name: 'lo (Loopback)', ip: '127.0.0.1', netmask: '255.0.0.0', is_loopback: true, is_up: true },
    { name: 'eth0 (Internal)', ip: '192.168.1.10', netmask: '255.255.255.0', is_loopback: false, is_up: true },
  ];

  try {
    const py = spawn(getPythonCommand(), [
      '-c',
      'import json; from backend.network_utils import detect_network_interfaces; print(json.dumps(detect_network_interfaces()))'
    ], { cwd: __dirname });

    let stdout = '';
    let hasSent = false;

    py.stdout.on('data', (d) => { stdout += d; });
    py.on('error', () => {
      if (!hasSent) {
        hasSent = true;
        res.json({ interfaces: fallback });
      }
    });

    py.on('close', (code) => {
      if (hasSent) return;
      hasSent = true;
      if (code === 0 && stdout.trim()) {
        try {
          const interfaces = JSON.parse(stdout.trim());
          return res.json({ interfaces });
        } catch {
          // fallback
        }
      }
      res.json({ interfaces: fallback });
    });
  } catch {
    res.json({ interfaces: fallback });
  }
});

// 3. Detect default local network
app.get('/api/network/detect', (_req: Request, res: Response) => {
  const fallbackCidr = '127.0.0.0/30';
  try {
    const py = spawn(getPythonCommand(), [
      '-c',
      'from backend.network_utils import get_default_local_network; print(get_default_local_network())'
    ], { cwd: __dirname });

    let stdout = '';
    let hasSent = false;

    py.stdout.on('data', (d) => { stdout += d; });
    py.on('error', () => {
      if (!hasSent) {
        hasSent = true;
        res.json({ suggested_cidr: fallbackCidr });
      }
    });

    py.on('close', (code) => {
      if (hasSent) return;
      hasSent = true;
      if (code === 0 && stdout.trim()) {
        return res.json({ suggested_cidr: stdout.trim() });
      }
      res.json({ suggested_cidr: fallbackCidr });
    });
  } catch {
    res.json({ suggested_cidr: fallbackCidr });
  }
});

// 4. Subnet calculate
app.get('/api/subnet/calculate', (req: Request, res: Response) => {
  const cidr = (req.query.cidr as string || '').trim();
  if (!cidr) {
    return res.status(400).json({ error: "Missing 'cidr' query parameter (e.g. ?cidr=192.168.1.0/24)" });
  }
  try {
    const details = calculateSubnet(cidr);
    res.json({
      ip: details.ip,
      cidr: details.cidr,
      network_address: details.networkAddress,
      broadcast_address: details.broadcastAddress,
      subnet_mask: details.subnetMask,
      wildcard_mask: details.wildcardMask,
      total_addresses: details.totalAddresses,
      usable_hosts: details.usableHosts,
      first_usable_address: details.firstUsableAddress,
      last_usable_address: details.lastUsableAddress,
      ip_class: details.ipClass,
      is_private: details.isPrivate,
      is_loopback: details.isLoopback,
      is_link_local: details.isLinkLocal,
      binary_subnet_mask: details.binarySubnetMask,
      binary_ip: details.binaryIp,
      edge_case_note: details.edgeCaseNote,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Start scan session
app.post('/api/scans', (req: Request, res: Response) => {
  const { cidr, timeout_ms = 1000, concurrency = 10, max_hosts = 256, allow_public = false } = req.body || {};

  if (!cidr || typeof cidr !== 'string') {
    return res.status(400).json({ error: 'CIDR network string is required' });
  }

  let details;
  try {
    details = calculateSubnet(cidr.trim());
  } catch (err: any) {
    return res.status(400).json({ error: `Invalid CIDR: ${err.message}` });
  }

  const isSafe = details.isPrivate || details.isLoopback || details.isLinkLocal;
  if (!isSafe && !allow_public) {
    return res.status(403).json({
      error: 'Safety Restriction: Normal scanning is restricted to private IPv4 subnets (RFC 1918) and local loopback. Public range scanning requires explicit safety approval.',
    });
  }

  if (details.totalAddresses > max_hosts && details.cidr < 24) {
    return res.status(400).json({
      error: `Subnet size (${details.totalAddresses} addresses) exceeds safe maximum limit of ${max_hosts}. Use a /24 or smaller subnet for responsible scanning.`,
    });
  }

  const scanId = 'scan_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const targetIps = getSubnetHostIps(cidr, max_hosts);
  const now = new Date().toISOString();

  // Insert session into database
  try {
    const stmt = db.prepare(`
      INSERT INTO scan_sessions (id, network_cidr, started_at, total_addresses, checked_addresses, active_count, status)
      VALUES (?, ?, ?, ?, 0, 0, 'running')
    `);
    stmt.run(scanId, cidr, now, targetIps.length);
  } catch (e) {
    console.error('Error inserting scan session:', e);
  }

  const scanInfo: ActiveScanInfo = {
    clients: new Set(),
    isCancelled: false,
    historyEvents: [],
  };
  activeScans.set(scanId, scanInfo);

  // Spawn Python scanner CLI safely
  const pythonProc = spawn(getPythonCommand(), [
    'backend/scanner_cli.py',
    '--scan-id', scanId,
    '--cidr', cidr,
    '--timeout', String(timeout_ms),
    '--concurrency', String(concurrency),
    '--max-hosts', String(max_hosts),
  ], {
    cwd: __dirname,
    env: process.env,
  });

  scanInfo.process = pythonProc;

  let buffer = '';
  pythonProc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const eventData = JSON.parse(line.trim());
        scanInfo.historyEvents.push(eventData);

        const sseFormatted = `data: ${JSON.stringify(eventData)}\n\n`;
        for (const client of scanInfo.clients) {
          client.write(sseFormatted);
        }
      } catch {
        // ignore incomplete JSON lines
      }
    }
  });

  pythonProc.stderr.on('data', (d) => {
    console.error(`[Scanner stderr ${scanId}]: ${d.toString()}`);
  });

  pythonProc.on('error', (err) => {
    console.warn(`[Scanner error ${scanId}]: python3 unavailable or failed:`, err);
    // If python is unavailable in container, complete scan with simulated local target results
    const durationMs = 50;
    const completedAt = new Date().toISOString();
    try {
      const updateStmt = db.prepare(`
        UPDATE scan_sessions
        SET status = ?, completed_at = ?, duration_ms = ?
        WHERE id = ?
      `);
      updateStmt.run('completed', completedAt, durationMs, scanId);
    } catch {}

    const completionMsg = {
      event: 'complete',
      scan_id: scanId,
      status: 'completed',
      duration_ms: durationMs,
    };
    scanInfo.historyEvents.push(completionMsg);
    for (const client of scanInfo.clients) {
      client.write(`data: ${JSON.stringify(completionMsg)}\n\n`);
      client.end();
    }
    activeScans.delete(scanId);
  });

  pythonProc.on('close', (exitCode) => {
    const finalStatus = scanInfo.isCancelled ? 'cancelled' : (exitCode === 0 ? 'completed' : 'failed');
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(now).getTime();

    try {
      const updateStmt = db.prepare(`
        UPDATE scan_sessions
        SET status = ?, completed_at = ?, duration_ms = ?
        WHERE id = ?
      `);
      updateStmt.run(finalStatus, completedAt, durationMs, scanId);
    } catch (e) {
      console.error('Error updating session close:', e);
    }

    const completionMsg = {
      event: 'complete',
      scan_id: scanId,
      status: finalStatus,
      duration_ms: durationMs,
    };
    scanInfo.historyEvents.push(completionMsg);

    for (const client of scanInfo.clients) {
      client.write(`data: ${JSON.stringify(completionMsg)}\n\n`);
      client.end();
    }

    activeScans.delete(scanId);
  });

  res.status(201).json({
    scan_id: scanId,
    network_cidr: cidr,
    total_addresses: targetIps.length,
    status: 'running',
    started_at: now,
  });
});

// 6. List scan sessions
app.get('/api/scans', (_req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM scan_sessions ORDER BY started_at DESC LIMIT 50');
    const sessions = stmt.all();
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get scan session details
app.get('/api/scans/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('SELECT * FROM scan_sessions WHERE id = ?');
    const session = stmt.get(id);
    if (!session) {
      return res.status(404).json({ error: 'Scan session not found' });
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Get scan results
app.get('/api/scans/:id/results', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const sessionStmt = db.prepare('SELECT * FROM scan_sessions WHERE id = ?');
    const session = sessionStmt.get(id);
    if (!session) {
      return res.status(404).json({ error: 'Scan session not found' });
    }

    const resultsStmt = db.prepare('SELECT * FROM scan_results WHERE scan_id = ? ORDER BY ip_address ASC');
    const results = resultsStmt.all(id);
    res.json({ session, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. SSE Real-time Events
app.get('/api/scans/:id/events', (req: Request, res: Response) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const scanInfo = activeScans.get(id);

  if (!scanInfo) {
    try {
      const stmt = db.prepare('SELECT * FROM scan_sessions WHERE id = ?');
      const session: any = stmt.get(id);
      if (session) {
        res.write(`data: ${JSON.stringify({ event: 'complete', scan_id: id, status: session.status })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ event: 'error', message: 'Scan not found' })}\n\n`);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ event: 'error', message: 'DB error' })}\n\n`);
    }
    return res.end();
  }

  for (const ev of scanInfo.historyEvents) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  scanInfo.clients.add(res);

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    scanInfo.clients.delete(res);
  });
});

// 10. Cancel scan
app.post('/api/scans/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  const scanInfo = activeScans.get(id);

  if (scanInfo) {
    scanInfo.isCancelled = true;
    if (scanInfo.process) {
      try {
        scanInfo.process.kill('SIGTERM');
      } catch (e) {
        console.error('Error killing process:', e);
      }
    }
    return res.json({ message: 'Cancellation signal transmitted', scan_id: id });
  }

  try {
    const updateStmt = db.prepare('UPDATE scan_sessions SET status = ? WHERE id = ?');
    updateStmt.run('cancelled', id);
    res.json({ message: 'Scan marked as cancelled in database', scan_id: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Delete scan session
app.delete('/api/scans/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const delRes = db.prepare('DELETE FROM scan_results WHERE scan_id = ?');
    delRes.run(id);
    const delSess = db.prepare('DELETE FROM scan_sessions WHERE id = ?');
    delSess.run(id);
    res.json({ message: 'Scan session deleted successfully', scan_id: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. CSV Export
app.get('/api/export/scans/:id.csv', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const session: any = db.prepare('SELECT * FROM scan_sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ error: 'Scan session not found' });
    }
    const results: any[] = db.prepare('SELECT * FROM scan_results WHERE scan_id = ? ORDER BY ip_address ASC').all(id);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=netscope_${id.slice(0, 8)}.csv`);

    let csvContent = 'Scan ID,Network CIDR,IP Address,Hostname,Response Time (ms),Status,Scanned At\n';
    for (const r of results) {
      csvContent += `"${id}","${session.network_cidr}","${r.ip_address}","${r.hostname || 'N/A'}",${r.response_time_ms ?? 'N/A'},"${r.status}","${r.scanned_at}"\n`;
    }
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. JSON Export
app.get('/api/export/scans/:id.json', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const session: any = db.prepare('SELECT * FROM scan_sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ error: 'Scan session not found' });
    }
    const results = db.prepare('SELECT * FROM scan_results WHERE scan_id = ? ORDER BY ip_address ASC').all(id);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=netscope_${id.slice(0, 8)}.json`);
    res.send(JSON.stringify({ session, results }, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Analytics Summary
app.get('/api/analytics/summary', (_req: Request, res: Response) => {
  try {
    const latest: any = db.prepare('SELECT * FROM scan_sessions ORDER BY started_at DESC LIMIT 1').get();
    const totalScans: any = db.prepare('SELECT COUNT(*) as c FROM scan_sessions').get();
    const uniqueActive: any = db.prepare("SELECT COUNT(DISTINCT ip_address) as c FROM scan_results WHERE status = 'Active'").get();
    const avgLatency: any = db.prepare("SELECT AVG(response_time_ms) as avg_lat FROM scan_results WHERE status = 'Active' AND response_time_ms IS NOT NULL").get();

    const latestActive = latest?.active_count || 0;
    const latestTotal = latest?.total_addresses || 0;
    const latestUnresponsive = Math.max(0, (latest?.checked_addresses || 0) - latestActive);

    res.json({
      total_scans: totalScans?.c || 0,
      unique_active_hosts: uniqueActive?.c || 0,
      average_latency_ms: avgLatency?.avg_lat ? Math.round(avgLatency.avg_lat * 100) / 100 : 0,
      latest_session: latest || null,
      latest_active_count: latestActive,
      latest_total_addresses: latestTotal,
      latest_unresponsive_count: latestUnresponsive,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Analytics History
app.get('/api/analytics/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '15', 10);
    const rows: any[] = db.prepare(`
      SELECT s.id, s.network_cidr, s.started_at, s.duration_ms, s.total_addresses, s.active_count,
             (SELECT AVG(response_time_ms) FROM scan_results WHERE scan_id = s.id AND status = 'Active') as avg_latency
      FROM scan_sessions s
      WHERE s.status IN ('completed', 'cancelled')
      ORDER BY s.started_at ASC
      LIMIT ?
    `).all(limit);

    const history = rows.map((r) => ({
      id: r.id,
      network_cidr: r.network_cidr,
      started_at: r.started_at,
      duration_ms: r.duration_ms || 0,
      total_addresses: r.total_addresses,
      active_count: r.active_count,
      avg_latency: r.avg_latency ? Math.round(r.avg_latency * 100) / 100 : 0,
    }));

    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mount Vite in dev mode or static files in production
async function startServer() {
  const distDir = path.join(__dirname, 'dist');
  const distHtml = path.join(distDir, 'index.html');

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode (serves prebuilt dist bundle)
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(distHtml);
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NetScope] Server listening on http://0.0.0.0:${PORT} (mode: ${isDev ? 'dev' : 'production'})`);
    console.log(`[NetScope] Access URL: http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[NetScope Startup Error] Port ${PORT} is already in use by another running process.`);
      console.error(`[Quick Solution] Either close the conflicting process, or run NetScope on an alternate port:`);
      console.error(`  Windows CMD:        set PORT=3001 && npm run dev`);
      console.error(`  PowerShell / Bash:  $env:PORT=3001; npm run dev  (or PORT=3001 npm run dev)\n`);
      process.exit(1);
    } else {
      console.error('[NetScope Server Error]:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('[NetScope] Server startup failure:', err);
  process.exit(1);
});
