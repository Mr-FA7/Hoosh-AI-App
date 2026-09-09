#!/usr/bin/env python3
"""
Hoosh Desktop — local-first Control Plane shell (PyQt6 WebEngine).

Starts Hoosh Runtime (companion) on 127.0.0.1 and opens the UI only inside
this window. Generic browsers cannot use the SPA when desktop gate is on.

Dev:
  pip install -r desktop/requirements.txt
  npm run build   # once, so companion can serve dist/
  python desktop/main.py
"""
from __future__ import annotations

import atexit
import secrets
import sys
from pathlib import Path

# Allow `python desktop/main.py` from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from constants import DEFAULT_PORT, ENV_TOKEN, UA_MARKER  # noqa: E402
from companion_proc import CompanionProcess, find_node  # noqa: E402
from browser_window import HooshBrowserWindow  # noqa: E402


def main() -> int:
    from PyQt6.QtWidgets import QApplication, QMessageBox

    token = secrets.token_hex(16)
    port = DEFAULT_PORT
    companion = CompanionProcess(token=token, port=port)

    app = QApplication(sys.argv)
    app.setApplicationName("Hoosh")
    app.setOrganizationName("Hoosh")

    if not find_node():
        QMessageBox.critical(
            None,
            "Hoosh Desktop",
            "Node.js is required for Hoosh Runtime.\n\n"
            "Install from https://nodejs.org then open Hoosh Desktop again.",
        )
        return 1

    try:
        companion.start()
    except Exception as e:
        QMessageBox.critical(None, "Hoosh Desktop", str(e))
        return 1

    atexit.register(companion.stop)

    url = f"http://127.0.0.1:{port}/"
    win = HooshBrowserWindow(url, token)
    win.show()
    print(f"[Hoosh Desktop] UI {url} · marker {UA_MARKER} · token env {ENV_TOKEN}")
    code = app.exec()
    companion.stop()
    return int(code)


if __name__ == "__main__":
    raise SystemExit(main())
