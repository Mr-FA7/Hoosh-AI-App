# Install Hoosh Local Bridge Chrome extension
param([switch]$Silent)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms | Out-Null

$InstallDir = $PSScriptRoot
$HooshDir   = Join-Path $env:LOCALAPPDATA 'Hoosh'
$ExtDir     = Join-Path $HooshDir 'extension'
$Marker     = Join-Path $HooshDir 'extension-installed.ok'

# ---- Find Chrome ----
$ChromePath = @(
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
  "C:\Program Files\Google\Chrome\Application\chrome.exe"
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $ChromePath) {
  [System.Windows.Forms.MessageBox]::Show(
    "Chrome not found. Install Google Chrome first, then run this again.",
    "Hoosh Bridge", "OK", "Error") | Out-Null
  exit 1
}

# ---- Copy extension files ----
$src = Join-Path $InstallDir 'extension'
if (-not (Test-Path (Join-Path $src 'manifest.json'))) {
  [System.Windows.Forms.MessageBox]::Show(
    "Extension files missing in $src",
    "Hoosh Bridge", "OK", "Error") | Out-Null
  exit 1
}

New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null
Copy-Item -Path (Join-Path $src '*') -Destination $ExtDir -Recurse -Force -Exclude 'key.pem'

# ---- Close Chrome so --load-extension takes effect ----
$chrome = Get-Process chrome -ErrorAction SilentlyContinue
if ($chrome) {
  if (-not $Silent) {
    $answer = [System.Windows.Forms.MessageBox]::Show(
      "Chrome will close for 3 seconds to load the extension, then reopen.`nSave any open work first.`n`nContinue?",
      "Hoosh Bridge", "YesNo", "Question")
    if ($answer -ne 'Yes') { exit 0 }
  }
  $chrome | Stop-Process -Force
  Start-Sleep -Seconds 3
}

# ---- Launch Chrome with --load-extension ----
$extPath = $ExtDir
Start-Process -FilePath $ChromePath -ArgumentList "--load-extension=`"$extPath`"", "https://aihoosh.com/" | Out-Null

Set-Content -Path $Marker -Value (Get-Date -Format 'o') -Encoding UTF8

if (-not $Silent) {
  [System.Windows.Forms.MessageBox]::Show(
    "Done!`n`nChrome opened with Hoosh Local Bridge extension.`n`nIMPORTANT: If Chrome shows`n`"Disable developer mode extensions?"`n`nClick KEEP (not Disable).`n`nThen refresh aihoosh.com — the green light will appear.",
    "Hoosh Bridge — Extension Installed", "OK", "Information") | Out-Null
}

exit 0
