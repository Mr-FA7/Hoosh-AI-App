Hoosh Companion — macOS
=======================

ONE-CLICK INSTALL (recommended)
  1. Open HooshCompanionSetup.dmg
  2. Double-click “Install Hoosh Companion”
  3. Click Install
  4. The app is copied to ~/Applications and starts automatically
  5. When Chrome asks “aihoosh.com wants to access other apps”, click ALLOW

If macOS says the app can’t be opened:
  System Settings → Privacy & Security → scroll down → Open Anyway
  (unsigned downloads need this once)

WHAT IT DOES
  - Starts the Hoosh companion in the background (no Terminal window)
  - Opens https://aihoosh.com
  - On first run it may download Hoosh and install dependencies (~1–2 min)

REQUIREMENTS
  - Node.js (https://nodejs.org) — the app opens the download page if missing
  - git — only if Hoosh isn’t already on this Mac (first-time clone)

TO STOP
  Open Hoosh Companion again from Applications and choose “Stop”.

Logs: ~/.hoosh/companion.log and ~/.hoosh/companion.log.run
