"""
Start / stop Hoosh Local Runtime (companion.js) for the desktop shell.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

from constants import DEFAULT_PORT, ENV_SHELL, ENV_TOKEN, UA_MARKER


def repo_root() -> Path:
    """Resolve Runtime root: HOOSH_ROOT, frozen Resources/runtime, or repo parent."""
    env = os.environ.get("HOOSH_ROOT", "").strip()
    if env:
        p = Path(env)
        if (p / "companion.js").is_file():
            return p

    if getattr(sys, "frozen", False):
        # PyInstaller: MacOS/Hoosh → Contents/Resources/runtime
        exe = Path(sys.executable).resolve()
        candidates = [
            exe.parent.parent / "Resources" / "runtime",
            exe.parent / "runtime",
            Path(getattr(sys, "_MEIPASS", exe.parent)) / "runtime",
        ]
        for c in candidates:
            if (c / "companion.js").is_file():
                return c

    # Dev: desktop/../
    return Path(__file__).resolve().parent.parent


def find_node() -> Optional[str]:
    for cand in ("node", "/opt/homebrew/bin/node", "/usr/local/bin/node"):
        try:
            subprocess.run([cand, "-v"], capture_output=True, check=True)
            return cand
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    return None


class CompanionProcess:
    def __init__(self, token: str, port: int = DEFAULT_PORT):
        self.token = token
        self.port = port
        self.proc: Optional[subprocess.Popen] = None
        self.log_path = Path.home() / ".hoosh" / "desktop-companion.log"

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def _env(self) -> dict:
        env = os.environ.copy()
        env[ENV_SHELL] = "1"
        env[ENV_TOKEN] = self.token
        env["FA7_BIND"] = "127.0.0.1"
        env["FA7_PORT"] = str(self.port)
        env["FA7_ELECTRON_MODE"] = "1"  # serve SPA from dist/ via companion
        env["FA7_DESKTOP_UA_MARKER"] = UA_MARKER
        env["HOOSH_ROOT"] = str(repo_root())
        return env

    def is_healthy(self) -> bool:
        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/v3/runtime/health",
                headers={"User-Agent": f"Hoosh-Desktop-Probe {UA_MARKER}/{self.token}"},
            )
            with urllib.request.urlopen(req, timeout=2) as res:
                return 200 <= res.status < 300
        except (urllib.error.URLError, TimeoutError, OSError):
            return False

    def start(self) -> None:
        if self.is_healthy():
            return
        node = find_node()
        if not node:
            raise RuntimeError(
                "Node.js not found. Install from https://nodejs.org then launch Hoosh Desktop again."
            )
        root = repo_root()
        companion = root / "companion.js"
        if not companion.is_file():
            raise RuntimeError(f"companion.js not found at {companion}")
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        log_f = open(self.log_path, "a", encoding="utf-8")
        self.proc = subprocess.Popen(
            [node, str(companion)],
            cwd=str(root),
            env=self._env(),
            stdout=log_f,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        deadline = time.time() + 45
        while time.time() < deadline:
            if self.is_healthy():
                return
            if self.proc.poll() is not None:
                raise RuntimeError(
                    f"Companion exited early (code {self.proc.returncode}). See {self.log_path}"
                )
            time.sleep(0.4)
        raise RuntimeError(f"Companion did not become healthy in time. See {self.log_path}")

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=5)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
            self.proc = None
