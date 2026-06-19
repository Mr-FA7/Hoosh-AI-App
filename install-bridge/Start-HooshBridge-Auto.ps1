# Hoosh Local Bridge — opens YOUR Chrome with extension loaded (automatic)
$ErrorActionPreference = 'Stop'

$InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\Hoosh Bridge'
$ExtDir = Join-Path $env:LOCALAPPDATA 'Hoosh\extension'
$ExtId = 'didfhjhlcekofdelbjaccnpikhfnhppa'

$ChromeCandidates = @(
  Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'
  Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'
  Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'
)
$Chrome = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not (Test-Path (Join-Path $InstallDir 'start-companion.cmd'))) {
  [System.Windows.Forms.MessageBox]::Show(
    'Hoosh Bridge is not installed. Run HooshBridgeSetup.exe on your Desktop first.',
    'Hoosh Local Bridge', 'OK', 'Error') | Out-Null
  exit 1
}

Add-Type -AssemblyName System.Windows.Forms | Out-Null

# Sync extension (path without spaces — required by Chrome)
New-Item -ItemType Directory -Force -Path $ExtDir | Out-Null
Copy-Item -Path (Join-Path $InstallDir 'extension\*') -Destination $ExtDir -Recurse -Force
$Version = (Get-Content (Join-Path $ExtDir 'manifest.json') -Raw | ConvertFrom-Json).version

# 1) Companion
& (Join-Path $InstallDir 'start-companion.cmd') | Out-Null
Start-Sleep -Seconds 2

# 2) Register extension path (best-effort)
$regPath = "HKCU:\Software\Google\Chrome\Extensions\$ExtId"
New-Item -Path $regPath -Force | Out-Null
Set-ItemProperty -Path $regPath -Name 'path' -Value $ExtDir -Type String
Set-ItemProperty -Path $regPath -Name 'version' -Value $Version -Type String

if (-not $Chrome) {
  Start-Process 'https://aihoosh.com/'
  exit 0
}

# 3) Chrome MUST restart — --load-extension is IGNORED if Chrome is already running
$running = Get-Process chrome -ErrorAction SilentlyContinue
if ($running) {
  $answer = [System.Windows.Forms.MessageBox]::Show(
    "Chrome will close and reopen with the Hoosh extension.`n`nWithout this, aihoosh.com stays RED (no connection to your PC).`n`nContinue?",
    'Hoosh Local Bridge',
    'YesNo',
    'Question'
  )
  if ($answer -ne 'Yes') { exit 0 }
  $running | Stop-Process -Force
  Start-Sleep -Seconds 2
}

# 4) Launch normal Chrome profile WITH extension (same browser you always use)
$argList = @(
  "--load-extension=$ExtDir"
  "--disable-extensions-except=$ExtDir"
  '--new-window'
  'https://aihoosh.com/'
)
Start-Process -FilePath $Chrome -ArgumentList $argList | Out-Null

[System.Windows.Forms.MessageBox]::Show(
  "Hoosh opened aihoosh.com in Chrome with the bridge extension.`n`nWait 5 seconds — the light should turn GREEN.`n`nAlways use the desktop shortcut 'Hoosh Local Bridge' (not a normal Chrome tab).",
  'Hoosh Local Bridge',
  'OK',
  'Information'
) | Out-Null
