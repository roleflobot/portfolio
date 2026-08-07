@echo off
setlocal

echo Starting saju server...
start "saju server" /D "%~dp0" cmd /k uvicorn main:app --reload

echo Waiting for server to become ready...
:waitloop
curl -s -o nul http://localhost:8000
if errorlevel 1 (
    timeout /t 1 >nul
    goto waitloop
)

start "" http://localhost:8000

echo Server window opened. Keep it open while using the site.
echo Closing that window will stop the server.
pause >nul
