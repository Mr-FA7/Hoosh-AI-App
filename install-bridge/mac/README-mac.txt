Hoosh Companion — macOS
=======================

FIRST LAUNCH (important — one time only):
  Because the app is downloaded from the web, macOS Gatekeeper blocks a
  normal double-click the first time. Do this once:

    1. Right-click (or Control-click) HooshCompanion.app
    2. Choose "Open"
    3. In the dialog, click "Open" again

  After that, a normal double-click works every time.

WHAT IT DOES:
  - Starts the Hoosh companion in the background (no Terminal to keep open)
  - Opens aihoosh.com
  - When Chrome asks "aihoosh.com wants to access other apps on this
    device", click ALLOW — that is what connects the site to your computer.

REQUIREMENTS:
  - Node.js (https://nodejs.org). The app opens the download page if missing.
  - On very first run it downloads Hoosh and installs dependencies (~1–2 min);
    you'll get notifications as it progresses.

TO STOP IT:
  Open HooshCompanion.app again and choose "Stop".

Logs: ~/.hoosh/companion.log and ~/.hoosh/companion.log.run
