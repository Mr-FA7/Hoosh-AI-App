@echo off
title Hoosh Companion
color 0A
cls

echo.
echo  ╔══════════════════════════════╗
echo  ║     Hoosh AI  Companion      ║
echo  ║   http://127.0.0.1:3001      ║
echo  ╚══════════════════════════════╝
echo.
echo  این پنجره را باز نگه دارید.
echo  aihoosh.com را در مرورگر باز کنید.
echo.

set "ROOT=%~dp0"
set "NODE=%ROOT%node\node.exe"
set "APP=%ROOT%app\companion.js"

if not exist "%NODE%" (
  echo  Node.js bundled not found - trying system node...
  where node >nul 2>&1
  if errorlevel 1 (
    echo.
    echo  ERROR: Node.js not found.
    echo  Please install from https://nodejs.org
    pause
    exit /b 1
  )
  set "NODE=node"
)

if not exist "%APP%" (
  set "APP=%ROOT%companion.js"
)

if not exist "%APP%" (
  echo  ERROR: companion.js not found in %ROOT%
  pause
  exit /b 1
)

echo  Starting companion...
"%NODE%" "%APP%"
echo.
echo  Companion stopped.
pause
