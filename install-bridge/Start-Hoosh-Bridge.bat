@echo off
title Hoosh Local Bridge
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Hoosh-Bridge.ps1"
if errorlevel 1 pause
