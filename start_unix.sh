#!/usr/bin/env bash
# NetScope Linux/macOS Startup Script
set -e

echo "==================================================="
echo "Starting NetScope — Simple Network Scanner (Unix)  "
echo "==================================================="

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js 20+."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "[WARNING] python3 is not found in PATH."
fi

echo "[1/2] Checking npm dependencies..."
npm install

echo "[2/2] Launching NetScope Full-Stack Server on port 3000..."
echo "Access the application at http://localhost:3000"
npm run dev
