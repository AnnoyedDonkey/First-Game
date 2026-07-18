@echo off
REM ============================================================
REM  Geometric TD - Balance Lab launcher
REM  Double-click this file (or run it from a terminal) to:
REM    1. start the local server (serve.ps1) in its own window
REM    2. open the Balance Lab in your default browser
REM  Close that server window (or press Ctrl+C in it) to stop.
REM ============================================================

REM Run from this script's own folder, wherever it lives.
cd /d "%~dp0"

REM Port: defaults to 8420. To use another, run:  start-balance-lab.cmd 8500
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8420"

echo Starting Geometric TD server on http://localhost:%PORT% ...
start "Geometric TD server (port %PORT%)" powershell -ExecutionPolicy Bypass -File "serve.ps1" -Port %PORT%

REM Give the server a second to come up, then open the Lab.
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/balance-lab.html"

echo.
echo Balance Lab: http://localhost:%PORT%/balance-lab.html
echo Game:        http://localhost:%PORT%/
echo.
echo The server is running in a separate window titled
echo "Geometric TD server". Close it (or Ctrl+C) to stop.
