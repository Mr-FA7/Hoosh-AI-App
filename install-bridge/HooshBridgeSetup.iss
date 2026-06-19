; Hoosh Local Bridge — Windows installer (Inno Setup)
; Build: npm run bridge:installer:win

#define MyAppName "Hoosh Local Bridge"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Hoosh AI"
#define MyAppURL "https://aihoosh.com/"
#define MyAppExeName "open-hoosh.cmd"
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
CloseApplications=no
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
Source: "{#StagingDir}\win\*.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\win\*.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Comment: "Open aihoosh.com with local bridge"
Name: "{group}\Stop companion"; Filename: "taskkill"; Parameters: "/F /IM node.exe /FI ""WINDOWTITLE eq companion*"""; Comment: "Stop background companion"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; WorkingDir: "{app}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "HooshLocalBridge"; ValueData: """{app}\run-companion-hidden.vbs"""; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{app}\start-companion.cmd"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "Open aihoosh.com now"; Flags: postinstall nowait skipifsilent shellexec

[UninstallRun]
Filename: "{app}\stop-companion.cmd"; Flags: runhidden waituntilterminated; RunOnceId: "StopCompanion"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    { companion started via [Run] }
  end;
end;
