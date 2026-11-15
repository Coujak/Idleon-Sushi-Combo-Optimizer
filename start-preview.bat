@echo off
setlocal
cd /d "%~dp0"
set "PY_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PY_CMD=py -3"
if not defined PY_CMD (
 where python >nul 2>nul
 if not errorlevel 1 set "PY_CMD=python"
)
if not defined PY_CMD (
 echo A local web server is required to test Google sign-in.
 echo Install Python 3 from https://www.python.org/downloads/ and run this file again.
 pause
 exit /b 1
)
echo Starting Sushi Station Lab development preview on http://localhost:8765
echo Close the server window when finished.
start "Sushi Lab Preview Server" cmd /k "%PY_CMD% -m http.server 8765 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8765"
