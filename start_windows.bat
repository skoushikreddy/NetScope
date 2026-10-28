@echo off
REM NetScope Windows Startup Script for VS Code / Windows Command Prompt
title NetScope — Simple Network Scanner
cls
echo ===================================================================
echo     NetScope — Simple Network Scanner (Windows Launcher)
echo ===================================================================
echo.

REM 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [FATAL ERROR] Node.js is not installed or not in your Windows PATH.
    echo Please download and install Node.js (v20 or v22 recommended) from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 2. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    where py >nul 2>nul
    if %errorlevel% neq 0 (
        echo [WARNING] Python 3 was not found in your PATH.
        echo NetScope ICMP ping worker requires Python 3.10+.
        echo Subnet calculator will still function, but ICMP scanning requires Python.
        echo Download Python from https://www.python.org/downloads/
        echo (Make sure to check "Add Python to PATH" during installation)
        echo.
    ) else (
        echo [INFO] Python launcher 'py' found.
    )
) else (
    echo [INFO] Python executable found.
)

REM 3. Check node_modules
if not exist node_modules (
    echo [1/2] Installing npm packages (first-time setup)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check network connection and try again.
        pause
        exit /b 1
    )
) else (
    echo [1/2] Node modules already present.
)

REM 4. Check if Port 3000 is occupied
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo [WARNING] Port 3000 appears to already be in use by another application!
    echo If NetScope fails to bind, you can run:
    echo     set PORT=3001
    echo     npm run dev
    echo and open http://localhost:3001
    echo.
)

echo [2/2] Starting NetScope Full-Stack Server...
echo ===================================================================
echo Access the application in your browser at:
echo.
echo     http://localhost:3000
echo.
echo Press Ctrl+C in this terminal window to stop the server anytime.
echo ===================================================================
echo.

npm run dev
