@echo off
chcp 65001 >nul
title Карта Yoobi
cd /d "%~dp0"
rem Карта открывается в браузере; это окно — её сервер, не закрывайте его, пока пользуетесь картой.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
  echo.
  echo Не получилось запустить карту через PowerShell. Если установлен Python, запустите:
  echo   py -m http.server 8765 --bind 127.0.0.1
  echo и откройте в браузере http://127.0.0.1:8765/index.html
  pause
)
