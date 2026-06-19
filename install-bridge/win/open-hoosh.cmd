@echo off
set "ROOT=%~dp0"
call "%ROOT%start-companion.cmd"

set "EXT=%ROOT%extension"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  start "" "https://aihoosh.com"
  exit /b 0
)

start "" "%CHROME%" --load-extension="%EXT%" "https://aihoosh.com"
exit /b 0
