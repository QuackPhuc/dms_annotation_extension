@echo off
title NOTA Labeling Updater
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0updater\Install-NOTA-Updater.ps1"
if errorlevel 1 (
  echo.
  echo Cai dat that bai. Vui long chup man hinh loi nay.
) else (
  echo.
  echo Hoan tat. Tu lan sau chi can bam Update ngay trong extension.
)
pause
