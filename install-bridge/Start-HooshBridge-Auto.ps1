# Hoosh Local Bridge — fully automatic (no Load unpacked needed)
$ErrorActionPreference = 'Stop'

$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\Hoosh Bridge'
$ExtDir = Join-Path $env:LOCALAPPDATA 'Hoosh\extension'
$Profile = Join-Path $env:LOCALAPPDATA 'Hoosh\ChromeProfile'
$ExtId = 'didfhjhlcekofdelbjaccnpikhfnhppa'

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
  Write-Host 'Install Hoosh Bridge first: run HooshBridgeSetup.exe' -ForegroundColor Red
  Read-Host 'Press Enter'
  exit 1
}

# Sync extension to path WITHOUT spaces (Chrome --load-extension breaks on spaces)
New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null
Copy-Item -Path (Join-Path $InstallDir 'extension\*') -Destination $ExtDir -Recurse -Force

$Version = (Get-Content (Join-Path $ExtDir 'manifest.json') -Raw | ConvertFrom-Json).version

# 1) Companion on port 3001
& (Join-Path $InstallDir 'start-companion.cmd') | Out-Null
Start-Sleep -Seconds 2

try {
  (Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/v3/system/health' -UseBasicParsing -TimeoutSec 8).StatusCode | Out-Null
  Write-Host '  Companion: running on port 3001' -ForegroundColor Green
} catch {
  Write-Host '  Companion: still starting...' -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}

# 2) Auto-register Chrome extension (Windows registry)
$regPath = "HKCU:\Software\Google\Chrome\Extensions\$ExtId"
New-Item -Path $regPath -Force | Out-Null
Set-ItemProperty -Path $regPath -Name 'path' -Value $ExtDir -Type String
Set-ItemProperty -Path $regPath -Name 'version' -Value $Version -Type String
Write-Host "  Extension v$Version registered" -ForegroundColor Green

# 3) Open aihoosh.com in Hoosh Chrome (extension always loaded)
New-Item -ItemType Directory -Force -Path $Profile | Out-Null

if (-not $Chrome) {
  Start-Process 'https://aihoosh.com/'
  Write-Host '  Chrome not found — opened default browser' -ForegroundColor Yellow
  exit 0
}

$argList = @(
  "--user-data-dir=$Profile"
  "--load-extension=$ExtDir"
  "--disable-extensions-except=$ExtDir"
  '--new-window'
  'https://aihoosh.com/'
)

Start-Process -FilePath $Chrome -ArgumentList $argList | Out-Null
Write-Host '  Opened aihoosh.com with bridge extension' -ForegroundColor Green
Write-Host ''
Write-Host '  IMPORTANT: Use ONLY this Chrome window (Hoosh profile).' -ForegroundColor Yellow
Write-Host '  Wait 5 seconds — status light should turn green.' -ForegroundColor White
Write-Host ''
