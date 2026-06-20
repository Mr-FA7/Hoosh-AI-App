; Hoosh Local Bridge — Windows installer (Inno Setup)
; Build: npm run bridge:installer:win

#define MyAppName "Hoosh Local Bridge"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Hoosh AI"
#define MyAppURL "https://aihoosh.com/"
#define MyAppExeName "Start-HooshBridge-Auto.bat"
#define StagingDir "..\\build\\win-bridge-staging"

[Setup]
AppId={{A8F3C2E1-9B4D-4005-8E7F-1A2B3C4D5E6F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\Hoosh Bridge
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=no
PrivilegesRequired=lowest
OutputBaseFilename=HooshBridgeSetup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=yes
UninstallDisplayIcon={app}\open-hoosh.cmd
OutputDir=..\public

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce
Name: "autostart"; Description: "Start companion when Windows starts"; GroupDescription: "Startup:"; Flags: checkedonce

[Files]
Source: "{#StagingDir}\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StagingDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StagingDir}\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StagingDir}\win\hoosh-local-bridge.crx"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\win\*"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Comment: "Open aihoosh.com with local bridge"
Name: "{group}\Stop companion"; Filename: "taskkill"; Parameters: "/F /IM node.exe /FI ""WINDOWTITLE eq companion*"""; Comment: "Stop background companion"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; WorkingDir: "{app}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "HooshLocalBridge"; ValueData: """{app}\run-companion-hidden.vbs"""; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Register-HooshExtension.ps1"""; StatusMsg: "Preparing extension files..."; Flags: runhidden waituntilterminated
Filename: "{app}\start-companion.cmd"; WorkingDir: "{app}"; StatusMsg: "Starting companion..."; Flags: runhidden waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Install-Extension-InYourChrome.ps1"""; Description: "Install extension in your Chrome (recommended)"; Flags: postinstall waituntilterminated skipifsilent

[UninstallRun]
Filename: "{app}\stop-companion.cmd"; Flags: runhidden waituntilterminated; RunOnceId: "StopCompanion"

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  { Kill any running companion (node.exe) so the installer can replace node.exe }
  Exec('taskkill.exe', '/F /IM node.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
end;
