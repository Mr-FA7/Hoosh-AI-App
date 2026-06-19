Set sh = CreateObject("WScript.Shell")
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run Chr(34) & root & "\start-companion.cmd" & Chr(34), 0, False
