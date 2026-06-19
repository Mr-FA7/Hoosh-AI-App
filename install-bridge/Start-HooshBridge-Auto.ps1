# Hoosh Local Bridge — fully automatic (no Load unpacked needed)
$ErrorActionPreference = 'Stop'

$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\Hoosh Bridge'
$ExtDir = Join-Path $InstallDir 'extension'
$Profile = Join-Path $env:LOCALAPPDATA 'Hoosh\ChromeProfile'
$ExtId = 'didfhjhlcekofdelbjaccnpikhfnhppa'
$Version = '0.1.4'

$ChromeCandidates = @(
  Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'
  Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'
  Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'
)
$Chrome = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

Write-Host ''
Write-Host '  Hoosh Local Bridge — starting...' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path (Join-Path $InstallDir 'start-companion.cmd'))) {
  Write-Host "Install Hoosh Bridge first: run HooshBridgeSetup.exe" -ForegroundColor Red
  Read-Host 'Press Enter'
  exit 1
}

# 1) Companion on port 3001
& (Join-Path $InstallDir 'start-companion.cmd') | Out-Null
Start-Sleep -Seconds 2

try {
  (Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/v3/system/health' -UseBasicParsing -TimeoutSec 5).StatusCode | Out-Null
  Write-Host '  Companion: running on port 3001' -ForegroundColor Green
} catch {
  Write-Host '  Companion: starting (wait a few seconds)...' -ForegroundColor Yellow
}

# 2) Auto-register Chrome extension (Windows registry — no Load unpacked)
if (Test-Path (Join-Path $ExtDir 'manifest.json')) {
  $regPath = "HKCU:\Software\Google\Chrome\Extensions\$ExtId"
  New-Item -Path $regPath -Force | Out-Null
  Set-ItemProperty -Path $regPath -Name 'path' -Value $ExtDir -Type String
  Set-ItemProperty -Path $regPath -Name 'version' -Value $Version -Type String
  Write-Host '  Extension: registered automatically' -ForegroundColor Green
} else {
  Write-Host "  Extension folder missing: $ExtDir" -ForegroundColor Red
}

# 3) Open aihoosh.com with extension loaded (dedicated Hoosh Chrome profile)
New-Item -ItemType Directory -Force -Path $Profile | Out-Null

if (-not $Chrome) {
  Start-Process 'https://aihoosh.com'
  Write-Host '  Chrome not found — opened default browser' -ForegroundColor Yellow
  exit 0
}

$args = @(
  "--user-data-dir=`"$Profile`""
  "--load-extension=`"$ExtDir`""
  '--disable-extensions-except=' + "`"$ExtDir`""
  'https://aihoosh.com'
)
Start-Process -FilePath $Chrome -ArgumentList ($args -join ' ')
Write-Host '  Opening aihoosh.com with bridge extension...' -ForegroundColor Green
Write-Host ''
Write-Host '  Keep this window open. Use ONLY this Chrome window for aihoosh.com.' -ForegroundColor White
Write-Host ''
