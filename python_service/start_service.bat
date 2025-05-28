@echo off
echo Starting Speech Processing Service...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

REM Change to script directory
cd /d "%~dp0"

REM Install dependencies if needed
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install/upgrade dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Start the service
echo.
echo Starting service on http://localhost:8000
echo Press Ctrl+C to stop the service
echo.
python start_service.py

pause