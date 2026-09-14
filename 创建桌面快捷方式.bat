@echo off
chcp 65001 >nul
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcuts.ps1"
if errorlevel 1 (
  echo.
  echo [错误] 快捷方式创建失败。
  ping -n 6 127.0.0.1 >nul
  exit /b 1
)
echo.
ping -n 6 127.0.0.1 >nul
