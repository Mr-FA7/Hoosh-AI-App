# Install Hoosh Local Bridge extension into Chrome/Edge via Windows Registry
# Registry approach is permanent — survives Chrome restarts without developer-mode warnings
param([switch]$Silent)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms | Out-Null

$InstallDir  = $PSScriptRoot
$HooshDir    = Join-Path $env:LOCALAPPDATA 'Hoosh'
$ExtDir      = Join-Path $HooshDir 'extension'
$CrxDest     = Join-Path $HooshDir 'hoosh-local-bridge.crx'
$ExtId       = 'ompmlkjlllkclhbgjklenapfaacfhmjk'
$ExtVersion  = '0.2.0'
$Marker      = Join-Path $HooshDir 'extension-registered.ok'

function Show-Msg([string]$Text, [string]$Title = 'Hoosh Local Bridge', [string]$Buttons = 'OK', [string]$Icon = 'Information') {
  if ($Silent) { Write-Host $Text; return }
  [System.Windows.Forms.MessageBox]::Show($Text, $Title, $Buttons, $Icon) | Out-Null
}

function Find-Browser([string]$Name) {
  switch ($Name) {
    'chrome' {
      @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
        "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
      ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    }
    'edge' {
      @(
        "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
      ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    }
  }
}

# --- 1. Copy extension files and CRX to permanent location ---
try {
  $src = Join-Path $InstallDir 'extension'
  if (-not (Test-Path (Join-Path $src 'manifest.json'))) { throw "Extension source missing in $src" }
  New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null
  Copy-Item -Path (Join-Path $src '*') -Destination $ExtDir -Recurse -Force -Exclude 'key.pem'

  $crxSrc = Join-Path $InstallDir 'hoosh-local-bridge.crx'
  if (Test-Path $crxSrc) {
    Copy-Item -Path $crxSrc -Destination $CrxDest -Force
  }
} catch {
  Show-Msg $_.Exception.Message 'Hoosh Local Bridge' 'OK' 'Error'
  exit 1
}

# --- 2. Register via Windows Registry (permanent, no developer-mode warnings) ---
$registered = $false

function Register-ExtForBrowser([string]$RegRoot) {
  try {
    New-Item -Path "$RegRoot\$ExtId" -Force | Out-Null
    Set-ItemProperty -Path "$RegRoot\$ExtId" -Name 'path'    -Value $CrxDest
    Set-ItemProperty -Path "$RegRoot\$ExtId" -Name 'version' -Value $ExtVersion
    return $true
  } catch {
    return $false
  }
}

# Chrome
if (Test-Path $CrxDest) {
  $ok = Register-ExtForBrowser 'HKCU:\SOFTWARE\Google\Chrome\Extensions'
  if ($ok) { $registered = $true; Write-Host '[Hoosh] Registered for Chrome via registry' }
}

# Edge (Chromium) — accepts same extension format
if (Test-Path $CrxDest) {
  Register-ExtForBrowser 'HKCU:\SOFTWARE\Microsoft\Edge\Extensions' | Out-Null
}

# --- 3. Fallback: launch Chrome with --load-extension if registry method unavailable ---
$Chrome = Find-Browser 'chrome'
if (-not $registered -and $Chrome) {
  $running = Get-Process chrome -ErrorAction SilentlyContinue
  if ($running) {
    $running | Stop-Process -Force
    Start-Sleep -Seconds 2
  }
  Start-Process -FilePath $Chrome -ArgumentList @(
    "--load-extension=`"$ExtDir`""
    "https://aihoosh.com/"
  ) | Out-Null
}

# --- 4. Open Chrome if not already open ---
if ($Chrome -and -not (Get-Process chrome -ErrorAction SilentlyContinue)) {
  Start-Process $Chrome -ArgumentList 'https://aihoosh.com/' | Out-Null
}

Set-Content -Path $Marker -Value (Get-Date -Format 'o') -Encoding UTF8

$method = if ($registered) { 'via Windows Registry (permanent)' } else { 'via --load-extension' }
Show-Msg @"
Hoosh Local Bridge extension installed $method.

Next steps:
1. Open (or restart) Chrome
2. You may see: 'Hoosh Local Bridge has been added to Chrome' — click Keep
3. Go to aihoosh.com — the green light should appear

If you see a 'Disable developer mode' warning, choose Keep.
"@

exit 0
