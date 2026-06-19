@echo off
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%P >nul 2>&1
)
if exist "%~dp0companion.pid" del /f /q "%~dp0companion.pid"
exit /b 0
