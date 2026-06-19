@echo off
set "EXT=%~dp0extension"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

echo.
echo  Hoosh Local Bridge - Install extension once
echo  ===========================================
echo.
echo  1) Chrome Extensions will open
echo  2) Enable Developer mode (top right)
echo  3) Click "Load unpacked"
echo  4) Select this folder:
echo     %EXT%
echo.

start "" "chrome://extensions"
timeout /t 2 /nobreak >nul
explorer /select,"%EXT%\manifest.json"
pause
