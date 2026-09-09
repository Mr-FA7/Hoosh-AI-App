# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec — Hoosh Desktop Browser (PyQt6 WebEngine)."""

import os

block_cipher = None
root = os.path.abspath(SPECPATH)
protected = os.path.join(root, "..", "build", "desktop-protected")
protected = os.path.abspath(protected)
desktop_src = os.path.join(root)
use_protected = os.path.isfile(os.path.join(protected, "main.py"))

script = os.path.join(protected, "main.py") if use_protected else os.path.join(desktop_src, "main.py")
pathex = [protected if use_protected else desktop_src]
if use_protected:
    pathex.append(desktop_src)

datas = []
# Include sibling python modules for non-frozen imports during analysis
for name in ("constants.py", "companion_proc.py", "browser_window.py"):
    src = os.path.join(protected if use_protected else desktop_src, name)
    if os.path.isfile(src):
        datas.append((src, "."))

# PyArmor runtime if present
if use_protected and os.path.isdir(protected):
    for name in os.listdir(protected):
        if name.startswith("pyarmor_runtime"):
            p = os.path.join(protected, name)
            if os.path.isdir(p):
                datas.append((p, name))

a = Analysis(
    [script],
    pathex=pathex,
    binaries=[],
    datas=datas,
    hiddenimports=[
        "constants",
        "companion_proc",
        "browser_window",
        "PyQt6.QtCore",
        "PyQt6.QtGui",
        "PyQt6.QtWidgets",
        "PyQt6.QtWebEngineWidgets",
        "PyQt6.QtWebEngineCore",
        "PyQt6.QtWebEngineCore.QWebEngineUrlRequestInterceptor",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Hoosh",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="Hoosh",
)

app = BUNDLE(
    coll,
    name="Hoosh.app",
    icon=None,
    bundle_identifier="com.hoosh.desktop",
    info_plist={
        "CFBundleName": "Hoosh",
        "CFBundleDisplayName": "Hoosh",
        "CFBundleShortVersionString": "1.0.0",
        "NSHighResolutionCapable": True,
    },
)
