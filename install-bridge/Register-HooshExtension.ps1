# Sync extension from repo/dev install to Programs\Hoosh Bridge and register for current user
$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\Hoosh Bridge'
$ExtDir = Join-Path $InstallDir 'extension'
$ExtId = 'didfhjhlcekofdelbjaccnpikhfnhppa'

$Sources = @(
  Join-Path $env:LOCALAPPDATA 'Programs\Hoosh Bridge\extension'
  'C:\Users\MrFA7\Desktop\Hoosh-AI-App\Hoosh-AI-App-tmp\extensions\hoosh-local-bridge'
)
$Src = $Sources | Where-Object { Test-Path (Join-Path $_ 'manifest.json') } | Select-Object -Last 1
if (-not $Src) { throw 'Extension source not found' }

New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null
Copy-Item -Path (Join-Path $Src '*') -Destination $ExtDir -Recurse -Force
$version = (Get-Content (Join-Path $ExtDir 'manifest.json') -Raw | ConvertFrom-Json).version

$regPath = "HKCU:\Software\Google\Chrome\Extensions\$ExtId"
New-Item -Path $regPath -Force | Out-Null
Set-ItemProperty -Path $regPath -Name 'path' -Value $ExtDir -Type String
Set-ItemProperty -Path $regPath -Name 'version' -Value $version -Type String
Write-Host "Extension $version registered at $ExtDir (id $ExtId)"
