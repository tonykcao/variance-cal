@echo off
REM NookBook Quick Start Script for Windows
REM This script sets up the development environment quickly

echo.
echo === NookBook Quick Start ===
echo ============================
echo.

REM Check if Docker is running
echo [1/7] Checking Docker...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)
echo SUCCESS: Docker is running

REM Check if .env exists, if not copy from example
if not exist ".env" (
    echo [2/7] Creating .env file from .env.example...
    copy .env.example .env >nul
    echo SUCCESS: .env file created
) else (
    echo SUCCESS: .env file already exists
)

REM Install dependencies
echo.
echo [3/7] Installing dependencies...
call npm install
echo SUCCESS: Dependencies installed

REM Start MySQL container
echo.
echo [4/7] Starting MySQL container...
docker compose up -d db
echo Waiting for MySQL to be ready...
timeout /t 10 /nobreak >nul

REM Generate Prisma client
echo.
echo [5/7] Generating Prisma client...
call npm run db:generate
echo SUCCESS: Prisma client generated

REM Run migrations
echo.
echo [6/7] Running database migrations...
call npx prisma migrate dev --name init
echo SUCCESS: Database migrations complete

REM Seed the database
echo.
echo [7/7] Seeding database...
call npm run db:seed
echo SUCCESS: Database seeded

REM Success message
echo.
echo === SETUP COMPLETE ===
echo.
echo To start the development server, run:
echo   npm run dev
echo.
echo Available users for testing:
echo   - alice-user (User)
echo   - bob-user (User)
echo   - connor-admin (Admin)
echo.
echo The app will be available at: http://localhost:3000
echo Prisma Studio (database viewer): npm run db:studio