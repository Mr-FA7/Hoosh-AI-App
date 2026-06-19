# Hoosh Local Bridge — one-click launcher (Windows)
# Clones repo to %USERPROFILE%\Hoosh-AI-App if needed, starts companion, opens setup.

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Candidate = Split-Path -Parent $ScriptDir

if (Test-Path (Join-Path $Candidate 'companion.js')) {
  $Root = $Candidate
} else {
  $Root = Join-Path $env:USERPROFILE 'Hoosh-AI-App'
}

Write-Host ''
Write-Host '  Hoosh Local Bridge' -ForegroundColor Cyan
Write-Host '  ==================' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is not installed.' -ForegroundColor Red
  Write-Host 'Install from https://nodejs.org then run this again.' -ForegroundColor Yellow
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not (Test-Path (Join-Path $Root 'companion.js'))) {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host 'Hoosh-AI-App not found and git is missing.' -ForegroundColor Red
    Write-Host "Clone manually: git clone https://github.com/Mr-FA7/Hoosh-AI-App.git `"$Root`"" -ForegroundColor Yellow
    Read-Host 'Press Enter to exit'
    exit 1
  }
  Write-Host "Cloning Hoosh-AI-App to $Root ..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path (Split-Path $Root) | Out-Null
  git clone https://github.com/Mr-FA7/Hoosh-AI-App.git $Root
}

Set-Location $Root

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
  Write-Host 'Installing dependencies (first run)...' -ForegroundColor Yellow
  npm install --legacy-peer-deps
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not (Test-Path (Join-Path $Root 'public\hoosh-local-bridge.zip'))) {
  npm run bridge:pack 2>$null
}

$ZipPath = Join-Path $Root 'public\hoosh-local-bridge.zip'
$ExtPath = Join-Path $Root 'extensions\hoosh-local-bridge'

Write-Host ''
Write-Host 'Opening browser setup pages...' -ForegroundColor Green
Start-Process 'https://aihoosh.com'
Start-Sleep -Seconds 1
Start-Process 'chrome://extensions'
if (Test-Path $ZipPath) {
  Start-Process explorer.exe "/select,`"$ZipPath`""
} elseif (Test-Path $ExtPath) {
  Start-Process explorer.exe "`"$ExtPath`""
}

Write-Host ''
Write-Host '1) Unzip hoosh-local-bridge.zip' -ForegroundColor White
Write-Host '2) Chrome -> Extensions -> Load unpacked' -ForegroundColor White
Write-Host '3) Refresh aihoosh.com' -ForegroundColor White
Write-Host ''
Write-Host 'Keep this window open. Companion: http://127.0.0.1:3001' -ForegroundColor Green
Write-Host ''

npm run bridge
