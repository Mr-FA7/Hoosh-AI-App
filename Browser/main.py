import sys
import os
import time
import threading
import subprocess
from pathlib import Path

try:
    from PyQt6.QtCore import QUrl, QTimer, Qt, QSize
    from PyQt6.QtGui import QIcon, QColor
    from PyQt6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
    from PyQt6.QtWebEngineWidgets import QWebEngineView
    from PyQt6.QtWebEngineCore import QWebEngineProfile, QWebEnginePage
except ImportError:
    print("Error: PyQt6 or PyQt6-WebEngine not found.")
    print("Install them using: pip install PyQt6 PyQt6-WebEngine")
    sys.exit(1)

# Import bridge host
import bridge_host

class DesktopBrowser(QMainWindow):
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.setWindowTitle("FA7 OS — Desktop")
        self.setMinimumSize(QSize(1200, 800))
        
        # Setup Layout
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QVBoxLayout(self.central_widget)
        self.layout.setContentsMargins(0, 0, 0, 0)

        # Setup Webview
        self.browser = QWebEngineView()
        self.layout.addWidget(self.browser)
        
        # Setup Profile (isolated)
        profile = QWebEngineProfile.defaultProfile()
        profile.setHttpUserAgent(profile.httpUserAgent() + " FA7-Desktop-Shell")
        
        # Window Effects
        self.apply_vibrancy()

        # Load Page
        self.browser.setUrl(QUrl(self.url))

    def apply_vibrancy(self):
        """Apply platform-specific transparency/vibrancy effects."""
        if sys.platform == "darwin":
            # Basic macOS transparency
            self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
            self.setStyleSheet("background: transparent;")
            # To get real blur/vibrancy on macOS without pyobjc, 
            # we'd need some heavy ctypes or just rely on the frontend 
            # rendering a semi-transparent background.
        elif sys.platform == "win32":
            # Windows transparency
            self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
            self.setStyleSheet("background: transparent;")

    def handle_bridge_command(self, cmd, args):
        """Handler for bridge commands sent from the host."""
        print(f"[Bridge] Executing: {cmd} with {args}")
        
        if cmd == "set_window_appearance":
            opacity = args.get("opacity", 1.0)
            self.setWindowOpacity(float(opacity))
            return {"status": "success"}
        
        elif cmd == "open_path":
            path = args.get("path")
            if path:
                if sys.platform == "darwin":
                    subprocess.run(["open", path])
                elif sys.platform == "win32":
                    os.startfile(path)
                return {"status": "opened"}
            return {"status": "error", "message": "path is required"}

        elif cmd == "maximize_window":
            self.showMaximized()
            return {"status": "maximized"}

        return {"status": "unknown_command"}

def start_bridge_thread(window):
    """Run the bridge HTTP server in a separate thread."""
    def handler(cmd, args):
        # We must use QTimer to run UI changes on the main thread
        # but for simple data or commands that don't touch UI, we can call directly.
        # Here we just route to the window handler.
        return window.handle_bridge_command(cmd, args)

    bridge_host.BRIDGE_COMMAND_HANDLER = handler
    bridge_host.run_bridge_server(port=3003)

def main():
    app = QApplication(sys.argv)
    
    # URL of the Vite dev server
    target_url = "http://localhost:5173"
    
    window = DesktopBrowser(target_url)
    window.show()
    
    # Start Bridge Server
    bridge_thread = threading.Thread(target=start_bridge_thread, args=(window,), daemon=True)
    bridge_thread.start()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
