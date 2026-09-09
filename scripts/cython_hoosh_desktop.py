#!/usr/bin/env python3
"""
Optional Cython compile of hot-path Hoosh Desktop modules → build/desktop-protected/
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESKTOP = ROOT / "desktop"
OUT = ROOT / "build" / "desktop-protected"
WORK = ROOT / "build" / "desktop-cython-src"

MODULES = ("constants.py", "companion_proc.py")


SETUP_PY = '''
from setuptools import setup, Extension
from Cython.Build import cythonize

extensions = [
{exts}
]

setup(
    name="hoosh_desktop_cy",
    ext_modules=cythonize(extensions, compiler_directives={{"language_level": "3"}}),
)
'''


def main() -> int:
    try:
        import Cython  # noqa: F401
        import setuptools  # noqa: F401
    except ImportError:
        print("[cython] Cython/setuptools not installed — skip")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    if WORK.is_dir():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)

    ext_lines = []
    for name in MODULES:
        src = DESKTOP / name
        if not src.is_file():
            continue
        dest = WORK / name
        shutil.copy2(src, dest)
        mod = name.replace(".py", "")
        ext_lines.append(f'    Extension("{mod}", [r"{dest}"]),')

    if not ext_lines:
        print("[cython] No modules to compile")
        return 0

    setup_path = WORK / "setup_cython_hoosh.py"
    setup_path.write_text(SETUP_PY.format(exts="\n".join(ext_lines)), encoding="utf-8")

    try:
        subprocess.run(
            [sys.executable, str(setup_path), "build_ext", "--inplace"],
            cwd=str(WORK),
            check=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"[cython] build failed (optional): {e}")
        for name in MODULES:
            src = DESKTOP / name
            if src.is_file():
                shutil.copy2(src, OUT / name)
        return 0

    for p in WORK.glob("*.so"):
        shutil.copy2(p, OUT / p.name)
        print("[cython] →", OUT / p.name)
    for p in WORK.glob("*.pyd"):
        shutil.copy2(p, OUT / p.name)
        print("[cython] →", OUT / p.name)

    print("[cython] Done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
