@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title 图片站 · 本地预览

set "PORT=8000"
set "NO_BROWSER="
if /i "%~1"=="--no-browser" set "NO_BROWSER=1"
if not "%~1"=="" if not defined NO_BROWSER set "PORT=%~1"
set "URL=http://127.0.0.1:%PORT%/"
set "LOG=%TEMP%\fish-gallery-server.log"

REM ---------- 1. 端口已在监听：直接开页面，避免起出第二个服务 ----------
REM 注意：Windows 上 Python 的 HTTPServer 带 SO_REUSEADDR，同端口能绑两次，
REM       所以必须在这里预先判断，不能指望"绑定失败"来兜底。
netstat -ano | findstr /c:":%PORT% " | findstr /c:"LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [信息] 端口 %PORT% 上已经有服务在运行，直接打开页面。
  echo        要换端口运行：启动本地预览.bat 8080
  if not defined NO_BROWSER start "" "%URL%"
  ping -n 3 127.0.0.1 >nul
  exit /b 0
)

REM ---------- 2. 找到 Python ----------
set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY (
  where py >nul 2>&1 && set "PY=py"
)
if not defined PY (
  echo [错误] 没有找到 Python。请先安装 Python 3（安装时勾选 Add Python to PATH）。
  echo        或在本目录手动运行：python -m http.server %PORT%
  echo.
  pause
  exit /b 1
)

REM ---------- 3. 起服务并打开浏览器 ----------
echo ============================================================
echo   图片站 · 本地预览
echo   网址：%URL%
echo   目录：%CD%
echo   解释器：%PY%
echo.
echo   保持本窗口开着；关闭窗口即停止服务。
echo   换端口：启动本地预览.bat 8080     只起服务不开浏览器：启动本地预览.bat --no-browser
echo ============================================================
echo.
if not defined NO_BROWSER start "" "%URL%"

"%PY%" -m http.server %PORT% --bind 127.0.0.1 2>"%LOG%"
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo [错误] 服务异常退出（退出码 %RC%）。日志：
  echo ------------------------------------------------------------
  type "%LOG%"
  echo ------------------------------------------------------------
) else (
  echo 服务已停止。
)
echo.
pause
