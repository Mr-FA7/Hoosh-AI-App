"""
Hoosh Desktop — constants shared by shell and Runtime gate.
"""
import os

# Appended to Qt WebEngine User-Agent; companion middleware requires this + token match.
UA_MARKER = "Hoosh-Desktop"
HEADER_NAME = "X-Hoosh-Desktop-Token"
ENV_TOKEN = "FA7_DESKTOP_TOKEN"
ENV_SHELL = "FA7_DESKTOP_SHELL"
DEFAULT_PORT = int(os.environ.get("FA7_PORT", "3001"))


def make_user_agent(base: str, token: str) -> str:
    base = (base or "Mozilla/5.0").strip()
    return f"{base} {UA_MARKER}/{token}"
