@echo off
set "ROOT=%~dp0"
set "NODE=%ROOT%node\node.exe"
set "APP=%ROOT%app"

if not exist "%NODE%" exit /b 1
if not exist "%APP%\companion.js" exit /b 1

powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/v3/system/health' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 exit /b 0

cd /d "%APP%"
start "" /MIN "%NODE%" companion.js
exit /b 0
