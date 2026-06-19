@echo off
title Hoosh Local Bridge
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-HooshBridge-Auto.ps1"
if errorlevel 1 pause
