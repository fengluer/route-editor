@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\electron-builder\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo Building the installer. The first run can take several minutes.
call npm run dist
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Installer is in the release folder:
echo RouteEditor-Setup-1.0.0.exe
pause
