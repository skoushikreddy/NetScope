@echo off
REM NetScope Windows Startup Script
echo ===================================================
echo Starting NetScope — Simple Network Scanner (Windows)
echo ===================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Python is not found in PATH. Make sure Python 3.10+ is installed.
)

echo [1/2] Installing dependencies if needed...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo [2/2] Launching NetScope Full-Stack Server on port 3000...
echo Open your web browser to http://localhost:3000
npm run dev
