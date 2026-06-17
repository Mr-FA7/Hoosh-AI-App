# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None
root = os.getcwd()

# Define the paths for main script and bridge host
script = os.path.join(root, "Browser", "main.py")
bridge_host = os.path.join(root, "Browser", "bridge_host.py")

# Datas: Include the bridge_host and any static assets
datas_list = [
    (os.path.join(root, "Browser", "bridge_host.py"), "."),
    (os.path.join(root, "public", "fa7_logo.png"), "public"),
]

a = Analysis(
    [script],
    pathex=[root],
    binaries=[],
    datas=datas_list,
    hiddenimports=[
        "http.server",
        "json",
        "socket",
        "threading",
        "subprocess",
        "PyQt6.QtCore",
        "PyQt6.QtGui",
        "PyQt6.QtWidgets",
        "PyQt6.QtWebEngineWidgets",
        "PyQt6.QtWebEngineCore",
        "bridge_host",
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

if sys.platform == 'darwin':
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name="FA7-Desktop",
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
        name="FA7-Desktop",
    )
    app = BUNDLE(
        coll,
        name='FA7-Desktop.app',
        icon=None, # Will set if icon found
        bundle_identifier='com.fa7.desktop',
        info_plist={
            'NSHighResolutionCapable': True,
            'LSBackgroundOnly': False,
        }
    )
else:
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        [],
        name="FA7-Desktop",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
    )
