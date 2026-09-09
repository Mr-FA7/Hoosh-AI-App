#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Protect Hoosh Desktop Python shell with PyArmor (+ optional Cython).

Registers from OneDrive regfile (never committed):
  ~/Library/CloudStorage/OneDrive-Personal/pyarmor-regfile-11427.zip

Usage:
  python scripts/protect_hoosh_desktop.py
  python scripts/protect_hoosh_desktop.py --skip-register
  python scripts/protect_hoosh_desktop.py --no-cython

Output: build/desktop-protected/
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESKTOP = ROOT / "desktop"
OUT = ROOT / "build" / "desktop-protected"
DEFAULT_REG = Path.home() / "Library/CloudStorage/OneDrive-Personal/pyarmor-regfile-11427.zip"


def run(cmd: list[str], cwd: Path | None = None) -> bool:
    print("[protect]", " ".join(cmd))
    try:
        subprocess.run(cmd, cwd=str(cwd or ROOT), check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"[protect] FAIL: {e}")
        return False


def has_pyarmor() -> bool:
    try:
        subprocess.run(["pyarmor", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def register_pyarmor(reg_zip: Path) -> bool:
    if not reg_zip.is_file():
        print(f"[protect] Regfile not found: {reg_zip}")
        return False
    with tempfile.TemporaryDirectory(prefix="pyarmor-reg-") as tmp:
        tmp_p = Path(tmp)
        with zipfile.ZipFile(reg_zip, "r") as zf:
            zf.extractall(tmp_p)
        # Prefer a .zip regfile inside, else pyarmor-regfile-* dir / .txt
        candidates = list(tmp_p.rglob("pyarmor-regfile-*.zip")) + list(tmp_p.rglob("*.zip"))
        # Also look for already-extracted regfile folder
        reg_dirs = [p for p in tmp_p.rglob("*") if p.is_dir() and "pyarmor-regfile" in p.name.lower()]
        target = None
        if candidates:
            target = candidates[0]
        elif reg_dirs:
            target = reg_dirs[0]
        else:
            # use extracted root if it looks like a regfile
            files = list(tmp_p.iterdir())
            if len(files) == 1:
                target = files[0]
            else:
                target = tmp_p
        print(f"[protect] Registering with {target}")
        return run(["pyarmor", "reg", str(target)])


def do_cython() -> None:
    script = ROOT / "scripts" / "cython_hoosh_desktop.py"
    if script.is_file():
        run([sys.executable, str(script)])
    else:
        print("[protect] cython_hoosh_desktop.py missing — skip Cython")


def copy_plain_fallback() -> None:
    """If PyArmor unavailable, still produce a tree for PyInstaller."""
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ("main.py", "browser_window.py", "companion_proc.py", "constants.py", "requirements.txt", "README.md"):
        src = DESKTOP / name
        if src.is_file():
            shutil.copy2(src, OUT / name)
    print("[protect] Plain copy →", OUT)


def do_pyarmor() -> bool:
    OUT.mkdir(parents=True, exist_ok=True)
    # Obfuscate desktop package recursively into OUT
    ok = run(["pyarmor", "gen", "-O", str(OUT), "-r", str(DESKTOP)])
    if not ok:
        return False
    # Flatten if pyarmor nested under desktop/
    nested = OUT / "desktop"
    if nested.is_dir():
        for item in nested.iterdir():
            dest = OUT / item.name
            if dest.exists():
                if dest.is_dir():
                    shutil.rmtree(dest)
                else:
                    dest.unlink()
            shutil.move(str(item), str(dest))
        try:
            nested.rmdir()
        except OSError:
            pass
    print("[protect] PyArmor →", OUT)
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="Protect Hoosh Desktop with PyArmor + Cython")
    ap.add_argument("--regfile", type=Path, default=DEFAULT_REG, help="Path to pyarmor-regfile zip")
    ap.add_argument("--skip-register", action="store_true", help="Skip pyarmor reg step")
    ap.add_argument("--no-cython", action="store_true")
    ap.add_argument("--plain-only", action="store_true", help="Copy sources only (no PyArmor)")
    args = ap.parse_args()

    os.chdir(ROOT)
    if OUT.is_dir():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    if not args.no_cython:
        do_cython()

    if args.plain_only:
        copy_plain_fallback()
        return 0

    if not has_pyarmor():
        print("[protect] pyarmor not installed — pip install pyarmor; falling back to plain copy")
        copy_plain_fallback()
        return 0

    if not args.skip_register:
        register_pyarmor(args.regfile)

    if not do_pyarmor():
        print("[protect] PyArmor gen failed — plain copy fallback")
        copy_plain_fallback()
        return 1

    print("[protect] Done. Point PyInstaller at build/desktop-protected/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
