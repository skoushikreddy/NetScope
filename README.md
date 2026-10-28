# NetScope — Simple Network Scanner

A professional, full-stack IPv4 network scanner, host discovery tool, and subnet calculator developed for Computer Networks academic learning and administrative network inventory.

NetScope performs real ICMP Echo Request ping probes using platform-aware operating system utilities (Linux, macOS, Windows), measures sub-millisecond round-trip response times, resolves hostnames via reverse DNS (PTR), persists scan histories in a relational SQLite database, and streams live progress via Server-Sent Events (SSE).

---

## 1. System Architecture

```
+-------------------------------------------------------------------------+
|                  React 19 + TypeScript + Vite UI                        |
|   (Dashboard, Live Scanner, Device Inventory, History, Subnet Calc)    |
+------------------------------------+------------------------------------+
                                     | REST API & Server-Sent Events (SSE)
                                     v
+-------------------------------------------------------------------------+
|                    Full-Stack Server (Port 3000)                        |
|   - Express.js HTTP Gateway & SSE Multiplexer                           |
|   - CIDR Prefix Validation & RFC 1918 Private Range Safety Enforcement   |
+------------------------------------+------------------------------------+
                                     | Worker Process Execution
                                     v
+-------------------------------------------------------------------------+
|                       Python 3.10+ Scanner Core                         |
|   - scanner.py: Concurrent ThreadPoolExecutor                           |
|   - Subprocess OS Ping (/usr/bin/ping with platform-specific flags)     |
|   - Reverse DNS: socket.gethostbyaddr()                                 |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+-----------------------------------+  +----------------------------------+
|       Local Subnet Targets        |  |     SQLite Relational Database   |
|   (ICMP Echo Requests & Replies)  |  |   (scan_sessions, scan_results)  |
+-----------------------------------+  +----------------------------------+
```

---

## 2. Key Features

- **Live Host Discovery:** Probes active IPv4 endpoints in authorized CIDR blocks (e.g. `192.168.1.0/24`, `127.0.0.0/30`, `10.0.0.0/24`).
- **Real ICMP Pinging:** Platform-aware subprocess execution (`ping -c 1 -W` on Linux/macOS, `ping -n 1 -w` on Windows) with regex output parsing and monotonic wall-clock fallback.
- **Reverse DNS Resolution:** Automatic PTR record queries to resolve local hostnames without blocking the probing pipeline.
- **Live SSE Streaming:** Server-Sent Events deliver real-time progress percentages, elapsed time, and host discovery events directly to the UI table as they happen.
- **Persistent SQLite Storage:** Saves all scan sessions, discovered hosts, timestamps, and response times in `data/netscope.db`. Preserves full history across restarts.
- **IPv4 Subnet Calculator:** Computes network addresses, broadcast addresses, subnet masks, wildcard masks, and usable host counts for prefixes `/0` through `/32`, with special RFC 3021 `/31` point-to-point and `/32` single host handling.
- **Data Export:** Instant download of scan results in standardized CSV and JSON formats.
- **Visual Analytics:** Interactive Recharts graphs of active device distributions, latency progressions, and historical discovery trends.
- **Safety & Ethical Enforcement:** Restricts default scans to RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and local loopback, with bounded concurrency and subnet size limits.

---

## 3. Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React icons, Recharts
- **Backend (Standalone Flask):** Python 3.10+, Flask, Flask-CORS, `ipaddress`, `socket`, `subprocess`, `sqlite3`
- **Full-Stack Runtime:** Node.js 22, Express, `node:sqlite`, TypeScript, Vite Middleware
- **Database:** SQLite 3 with Foreign Key constraints and indexing

---

## 4. How to Access & Run NetScope

### ⚠️ Note on Cloud Environment vs. Local Machine
> **If you are viewing this project in Google AI Studio Build:**
> The backend and frontend run inside a remote cloud container. Typing `http://localhost:3000` into your personal computer's web browser will result in `ERR_CONNECTION_REFUSED (-102)` because the server is hosted remotely in the cloud, not on your personal laptop.
> 
> - **In AI Studio:** Click the **App Preview** window inside AI Studio, or use the provided Cloud Run App URL.
> - **On your local computer:** To use `http://localhost:3000`, follow the local setup steps below to clone and start the server on your personal machine.

---

### Running on Your Local Computer (Workstation)

#### Prerequisites
- Node.js 20+ installed
- Python 3.10+ installed
- Standard OS ping utility (present by default on Windows, Linux, and macOS)

#### Option A: Full-Stack Mode (Recommended)

In this mode, Express on port 3000 serves the React frontend, provides the REST API and Server-Sent Events (SSE) stream, runs the Python ICMP scanner core, and saves sessions to SQLite (`data/netscope.db`).

```bash
# 1. Install frontend & server dependencies
npm install

# 2. Run automated verification tests
npx tsx --test src/utils/subnetCalculator.test.ts
python3 -m unittest discover tests

# 3. Start development server on your local machine
npm run dev
```

Once running locally, open your web browser to:
👉 **`http://localhost:3000`**

---

### Option B: Standalone Python Flask Backend

If you prefer running the pure Python Flask REST API server independently:

#### On Linux / macOS
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

#### On Windows
```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The Flask server will start on `http://127.0.0.1:5000`.

---

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend service health check |
| `GET` | `/api/network/interfaces` | Enumerate available IPv4 interfaces |
| `GET` | `/api/network/detect` | Suggest default local network CIDR |
| `POST` | `/api/scans` | Create and start a new scan session |
| `GET` | `/api/scans` | List historical scan sessions |
| `GET` | `/api/scans/:id` | Fetch scan session details |
| `GET` | `/api/scans/:id/results` | Fetch discovered hosts for a session |
| `GET` | `/api/scans/:id/events` | Server-Sent Events (SSE) live progress stream |
| `POST` | `/api/scans/:id/cancel` | Cancel an ongoing scan |
| `DELETE` | `/api/scans/:id` | Delete a scan session and its results |
| `GET` | `/api/subnet/calculate?cidr=` | Calculate IPv4 subnet metrics |
| `GET` | `/api/export/scans/:id.csv` | Download scan results as CSV |
| `GET` | `/api/export/scans/:id.json` | Download scan results as JSON |
| `GET` | `/api/analytics/summary` | Global summary metrics |
| `GET` | `/api/analytics/history` | Historical session data points |

---

## 6. Database Schema

### `scan_sessions` Table
- `id` (TEXT PRIMARY KEY): Unique session UUID
- `network_cidr` (TEXT NOT NULL): Target CIDR subnet
- `started_at` (TEXT NOT NULL): ISO8601 UTC timestamp
- `completed_at` (TEXT): Completion timestamp
- `duration_ms` (INTEGER): Total elapsed milliseconds
- `total_addresses` (INTEGER NOT NULL): Total addresses in scope
- `checked_addresses` (INTEGER NOT NULL): Count of probed hosts
- `active_count` (INTEGER NOT NULL): Responsive host count
- `status` (TEXT NOT NULL): `running` \| `completed` \| `cancelled` \| `failed`

### `scan_results` Table
- `id` (TEXT PRIMARY KEY): Result UUID
- `scan_id` (TEXT NOT NULL): Foreign key referencing `scan_sessions(id)` ON DELETE CASCADE
- `ip_address` (TEXT NOT NULL): Probed IPv4 address
- `hostname` (TEXT): Resolved PTR hostname, or NULL
- `response_time_ms` (REAL): ICMP round-trip latency in ms
- `status` (TEXT NOT NULL): `Active` \| `No Response`
- `scanned_at` (TEXT NOT NULL): ISO8601 timestamp

---

## 7. Testing Instructions

Automated test suites verify subnet calculations, RFC 3021 edge cases, ping output parsing across OS formats, and database integrity.

```bash
# 1. Run Node.js subnet math unit tests
npx tsx --test src/utils/subnetCalculator.test.ts

# 2. Run Python backend unit tests
python3 -m unittest discover tests
```

---

## 8. Ethical Use & Responsible Scanning

NetScope is created strictly for educational Computer Networks laboratory exercises, local device inventory, and authorized network troubleshooting.

1. **Permission Required:** Only scan networks you own or have explicit administrative authorization to test.
2. **Private Ranges Enforced:** By default, public IPv4 addresses are blocked to prevent unsolicited scanning across Internet subnets.
3. **Controlled Concurrency:** Concurrency is bounded to prevent network interface congestion or switch packet flooding.
