import json
import socket
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Callable, Optional

# This will be set by Browser/main.py
BRIDGE_COMMAND_HANDLER: Optional[Callable[[str, dict], dict]] = None

class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _json_response(self, data: dict, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/__bridge__":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                cmd = data.get("cmd")
                args = data.get("args", {})
                
                if not cmd:
                    self._json_response({"ok": False, "error": "Missing command"}, 400)
                    return

                if BRIDGE_COMMAND_HANDLER:
                    result = BRIDGE_COMMAND_HANDLER(cmd, args)
                    self._json_response({"ok": True, "result": result})
                else:
                    self._json_response({"ok": False, "error": "Bridge handler not initialized"}, 503)
            except Exception as e:
                self._json_response({"ok": False, "error": str(e)}, 500)
        else:
            self.send_response(404)
            self.end_headers()

def run_bridge_server(port: int = 3003):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, BridgeHandler)
    print(f"[Bridge] Server running on http://127.0.0.1:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_bridge_server()
