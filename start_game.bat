@echo off
title SRPG Prototype - Game Server
echo ==========================================
echo Starting SRPG Prototype Development Server
echo ==========================================
echo.
cd /d "%~dp0"
call npm run dev
pause
