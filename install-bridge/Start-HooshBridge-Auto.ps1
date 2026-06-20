# Start companion + ensure extension is registered + open aihoosh.com
$ErrorActionPreference = 'Continue'
$InstallDir = $PSScriptRoot
$HooshDir   = Join-Path $env:LOCALAPPDATA 'Hoosh'
$ExtId      = 'ompmlkjlllkclhbgjklenapfaacfhmjk'
$CrxPath    = Join-Path $HooshDir 'hoosh-local-bridge.crx'
$OldMarker  = Join-Path $HooshDir 'extension-in-default-chrome.ok'
$NewMarker  = Join-Path $HooshDir 'extension-registered.ok'

# Start local companion in background
& (Join-Path $InstallDir 'start-companion.cmd') | Out-Null

# Re-register extension via registry on every launch (ensures it survives Chrome restarts)
if (Test-Path $CrxPath) {
  try {
    New-Item -Path "HKCU:\SOFTWARE\Google\Chrome\Extensions\$ExtId" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Google\Chrome\Extensions\$ExtId" -Name 'path'    -Value $CrxPath
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Google\Chrome\Extensions\$ExtId" -Name 'version' -Value '0.2.0'
    New-Item -Path "HKCU:\SOFTWARE\Microsoft\Edge\Extensions\$ExtId" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Edge\Extensions\$ExtId" -Name 'path'    -Value $CrxPath
    Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Edge\Extensions\$ExtId" -Name 'version' -Value '0.2.0'
  } catch { }
}

# First-time or forced re-install
$isRegistered = (Test-Path $NewMarker) -or (Test-Path $OldMarker)
if (-not $isRegistered) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $InstallDir 'Install-Extension-InYourChrome.ps1')
  exit $LASTEXITCODE
}

Start-Process 'https://aihoosh.com/'
exit 0
