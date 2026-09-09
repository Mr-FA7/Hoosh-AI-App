"""
PyQt6 WebEngine window for Hoosh Desktop — loads localhost Runtime UI only.
"""
from __future__ import annotations

import sys
from typing import Optional

from constants import HEADER_NAME, UA_MARKER, make_user_agent

try:
    from PyQt6.QtCore import QUrl, Qt
    from PyQt6.QtGui import QDesktopServices
    from PyQt6.QtWidgets import QMainWindow, QMessageBox
    from PyQt6.QtWebEngineCore import (
        QWebEnginePage,
        QWebEngineProfile,
        QWebEngineSettings,
    )
    from PyQt6.QtWebEngineWidgets import QWebEngineView
except ImportError as e:
    raise SystemExit(
        "PyQt6 / PyQt6-WebEngine required. Run:\n"
        "  pip install -r desktop/requirements.txt\n"
        f"({e})"
    ) from e


class HooshWebPage(QWebEnginePage):
    """Block leaving localhost; open external URLs in the system browser."""

    def __init__(self, profile: QWebEngineProfile, parent=None):
        super().__init__(profile, parent)

    def acceptNavigationRequest(self, url: QUrl, nav_type, is_main_frame: bool) -> bool:  # noqa: N802
        host = (url.host() or "").lower()
        scheme = (url.scheme() or "").lower()
        if scheme in ("http", "https") and host in ("127.0.0.1", "localhost"):
            return True
        if scheme in ("about", "data", "blob"):
            return True
        # External → OS browser
        QDesktopServices.openUrl(url)
        return False

    def createWindow(self, _type):  # noqa: N802
        return self

    def javaScriptConsoleMessage(self, level, message, line, source):  # noqa: N802
        # Keep quiet in production; useful when debugging
        if "--debug" in sys.argv:
            print(f"[js] {source}:{line} {message}")


class HooshBrowserWindow(QMainWindow):
    def __init__(self, start_url: str, token: str, parent=None):
        super().__init__(parent)
        self.token = token
        self.setWindowTitle("Hoosh")
        self.resize(1280, 840)

        profile = QWebEngineProfile("HooshDesktop", self)
        base_ua = profile.httpUserAgent()
        profile.setHttpUserAgent(make_user_agent(base_ua, token))

        # Inject header on all requests via interceptor if available
        try:
            from PyQt6.QtWebEngineCore import QWebEngineUrlRequestInterceptor

            class _Interceptor(QWebEngineUrlRequestInterceptor):
                def __init__(self, tok: str):
                    super().__init__()
                    self._tok = tok

                def interceptRequest(self, info):  # noqa: N802
                    info.setHttpHeader(
                        HEADER_NAME.encode("utf-8"),
                        self._tok.encode("utf-8"),
                    )

            interceptor = _Interceptor(token)
            profile.setUrlRequestInterceptor(interceptor)
            self._interceptor = interceptor
        except Exception:
            self._interceptor = None

        settings = profile.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.PluginsEnabled, False)
        # Discourage easy source peek (not a security boundary; Runtime gate is)
        try:
            settings.setAttribute(
                QWebEngineSettings.WebAttribute.JavascriptCanAccessClipboard, True
            )
        except Exception:
            pass

        self.view = QWebEngineView(self)
        page = HooshWebPage(profile, self.view)
        self.view.setPage(page)
        self.setCentralWidget(self.view)
        self.view.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)

        self.view.load(QUrl(start_url))

    def closeEvent(self, event):  # noqa: N802
        event.accept()
