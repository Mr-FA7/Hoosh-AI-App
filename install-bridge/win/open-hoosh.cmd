@echo off
set "ROOT=%~dp0"
call "%ROOT%start-companion.cmd"

set "EXT=%ROOT%extension"
set "PROFILE=%LOCALAPPDATA%\Hoosh\ChromeProfile"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  start "" "https://aihoosh.com"
  exit /b 0
)

if not exist "%PROFILE%" mkdir "%PROFILE%"

rem Dedicated Chrome profile so --load-extension works even if normal Chrome is already open
start "" "%CHROME%" --user-data-dir="%PROFILE%" --load-extension="%EXT%" "https://aihoosh.com"
exit /b 0
