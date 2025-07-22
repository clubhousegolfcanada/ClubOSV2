@echo off
echo Setting up ClubOSV1...

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo npm is not installed. Please install Node.js first.
    pause
    exit /b 1
)

echo Installing frontend dependencies...
cd ClubOSV1-frontend
call npm install

echo Installing backend dependencies...
cd ..\ClubOSV1-backend
call npm install

echo.
echo Dependencies installed!
echo.
echo IMPORTANT: Before running the application:
echo 1. Edit ClubOSV1-backend\.env and add your OpenAI API key
echo 2. Edit ClubOSV1-backend\.env and add your Slack webhook URL (optional)
echo.
echo To start the application:
echo 1. Backend: cd ClubOSV1-backend && npm run dev
echo 2. Frontend: cd ClubOSV1-frontend && npm run dev
echo.
echo The application will be available at http://localhost:3000
pause
