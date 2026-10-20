@echo off
title NOTA Labeling Updater
if "%~1"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0updater\Install-NOTA-Updater.ps1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0updater\Install-NOTA-Updater.ps1" -ExtensionId "%~1"
)
if errorlevel 1 (
  echo.
  echo Installation failed. Please capture the error shown above.
) else (
  echo.
  echo Done. For future updates, click Update now in the extension.
)
pause
