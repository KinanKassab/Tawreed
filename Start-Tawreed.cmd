@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-local.ps1"
if errorlevel 1 (
  echo.
  echo Tawreed could not start. Keep this window open and share the error shown above.
  pause
)
