@echo off
cd /d "%~dp0"

echo ================================================
echo  GTD Manager - Launch Script
echo ================================================
echo  Working directory: %CD%
echo.

:: Check for .env file
if not exist ".env" (
    echo [ERROR] .env file not found.
    echo  Copy .env.example to .env and add your API keys.
    echo.
    pause
    exit /b 1
)
echo [OK] .env file found

:: Check for Node / npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm not found. Is Node.js installed?
    echo  Download from https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version 2^>^&1') do echo [OK] npm version: %%v

:: Check for node_modules
if not exist "node_modules" (
    echo [INFO] node_modules not found - running npm install...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed with code %ERRORLEVEL%
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
) else (
    echo [OK] node_modules found
)

:: Check for vite config
if not exist "vite.config.js" (
    echo [ERROR] vite.config.js not found. Is this the right folder?
    pause
    exit /b 1
)
echo [OK] vite.config.js found

echo.
echo ================================================
echo  Starting Vite dev server...
echo  URL: http://localhost:5173
echo  Press Ctrl+C to stop
echo ================================================
echo.

npm run dev
echo.
echo [INFO] Server stopped (exit code: %ERRORLEVEL%)
pause
