@echo off
cd /d "%~dp0"

:: Check for .env file
if not exist ".env" (
    echo.
    echo  ERROR: .env file not found.
    echo  Copy .env.example to .env and add your Anthropic API key.
    echo.
    pause
    exit /b 1
)

:: Check for node_modules
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo.
echo  Starting GTD Manager...
echo  Opening in browser at http://localhost:5173
echo  Press Ctrl+C to stop the server.
echo.

npm run dev
