# Sync extension to space-free path and register in Chrome registry
$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\Hoosh Bridge'
$ExtDir = Join-Path $env:LOCALAPPDATA 'Hoosh\extension'
$ExtId = 'didfhjhlcekofdelbjaccnpikhfnhppa'

if (-not (Test-Path (Join-Path $InstallDir 'extension\manifest.json'))) {
  throw "Run HooshBridgeSetup.exe first. Missing: $InstallDir\extension"
}

New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null
Copy-Item -Path (Join-Path $InstallDir 'extension\*') -Destination $ExtDir -Recurse -Force
$version = (Get-Content (Join-Path $ExtDir 'manifest.json') -Raw | ConvertFrom-Json).version

$regPath = "HKCU:\Software\Google\Chrome\Extensions\$ExtId"
New-Item -Path $regPath -Force | Out-Null
Set-ItemProperty -Path $regPath -Name 'path' -Value $ExtDir -Type String
Set-ItemProperty -Path $regPath -Name 'version' -Value $version -Type String

# hoosh-bridge://open → desktop launcher (from aihoosh.com red panel)
$launcher = Join-Path $env:LOCALAPPDATA 'Programs\Hoosh Bridge\Start-HooshBridge-Auto.bat'
if (Test-Path $launcher) {
  New-Item -Path 'HKCU:\Software\Classes\hoosh-bridge' -Force | Out-Null
  Set-ItemProperty -Path 'HKCU:\Software\Classes\hoosh-bridge' -Name '(Default)' -Value 'URL:Hoosh Local Bridge'
  Set-ItemProperty -Path 'HKCU:\Software\Classes\hoosh-bridge' -Name 'URL Protocol' -Value ''
  New-Item -Path 'HKCU:\Software\Classes\hoosh-bridge\shell\open\command' -Force | Out-Null
  Set-ItemProperty -Path 'HKCU:\Software\Classes\hoosh-bridge\shell\open\command' -Name '(Default)' -Value "`"$launcher`""
}

Write-Host "Extension v$version -> $ExtDir (id $ExtId)"
