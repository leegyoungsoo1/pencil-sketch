@echo off
setlocal
cd /d "%~dp0"
start "Woong Admin Server" /min node admin-server.cjs
ping 127.0.0.1 -n 2 >nul
start "" "http://127.0.0.1:4173/renewal/woong-studio.html"
endlocal
