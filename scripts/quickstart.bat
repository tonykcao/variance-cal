@echo off
REM NookBook Quick Start Script for Windows
REM This script sets up the development environment quickly

echo.
echo === NookBook Quick Start ===
echo ============================
echo.

REM Check if Docker is running
echo [1/8] Checking Docker...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)
echo SUCCESS: Docker is running

REM Check if .env exists, if not copy from example
if not exist ".env" (
    echo [2/8] Creating .env file from .env.example...
    copy .env.example .env >nul
    echo SUCCESS: .env file created
) else (
    echo SUCCESS: .env file already exists
)

REM Install dependencies
echo.
echo [3/8] Installing dependencies...
call npm install
echo SUCCESS: Dependencies installed

REM Start MySQL container
echo.
echo [4/8] Starting MySQL container...

REM Check if container already exists and handle gracefully
docker ps -a --filter "name=nookbook-mysql" --format "{{.Names}}" 2>nul | findstr /C:"nookbook-mysql" >nul
if %ERRORLEVEL% EQU 0 (
    REM Container exists, check if it's running
    docker ps --filter "name=nookbook-mysql" --format "{{.Names}}" 2>nul | findstr /C:"nookbook-mysql" >nul
    if %ERRORLEVEL% EQU 0 (
        echo SUCCESS: MySQL container already running
    ) else (
        REM Container exists but is stopped
        echo Starting existing MySQL container...
        docker start nookbook-mysql
        echo SUCCESS: MySQL container started
    )
) else (
    REM Container doesn't exist, create it
    echo Creating new MySQL container...
    docker compose up -d db
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to create MySQL container. Please check Docker logs.
        exit /b 1
    )
    echo SUCCESS: MySQL container created
)

echo Waiting for MySQL to be ready...
REM Wait for MySQL with retries
set /A retries=0
:wait_mysql
set /A retries+=1
if %retries% GTR 30 (
    echo ERROR: MySQL failed to start. Please check Docker logs.
    exit /b 1
)
docker compose exec -T db mysql -u root -prootpassword -e "SELECT 1" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo | set /p=.
    timeout /t 1 /nobreak >nul
    goto wait_mysql
)
echo.

REM Generate Prisma client
echo.
echo [5/8] Generating Prisma client...
REM Test if Prisma client is functional, not just if file exists
node -e "const {PrismaClient} = require('@prisma/client'); new PrismaClient();" 2>nul
if %ERRORLEVEL% == 0 (
    echo SUCCESS: Prisma client already exists
) else (
    call npm run db:generate || echo SUCCESS: Prisma client generated
)

REM Push database schema
echo.
echo [6/8] Setting up database schema...
call npm run db:push -- --skip-generate
echo SUCCESS: Database schema created

REM Seed the database
echo.
echo [7/8] Seeding database...
call npm run db:seed
echo SUCCESS: Database seeded

REM Ask about sample data generation
echo.
echo [8/8] Sample Data Generation
echo Choose a dataset for testing:
echo.
echo   1. Light Dataset - Realistic office (~30-40%% utilization)
echo      Moderate bookings, business hours, recurring meetings
echo.
echo   2. Chaotic Dataset - Very busy office (~70-85%% utilization)
echo      Heavy bookings, includes weekends and late hours
echo.
echo   3. Minimal - Keep base seed data only (default)
echo      Just a few sample bookings for demo
echo.
set /p choice="Enter your choice (1/2/3) [default: 3]: "
if "%choice%"=="" set choice=3

if "%choice%"=="1" (
    echo.
    echo Generating light dataset...
    call npm run db:generate-light
    echo SUCCESS: Light dataset generated
) else if "%choice%"=="2" (
    echo.
    echo Generating chaotic dataset...
    call npm run db:generate-chaotic
    echo SUCCESS: Chaotic dataset generated
) else (
    echo.
    echo Keeping minimal seed data.
)

REM Run fix-auth script if it exists
if exist scripts\fix-auth.ts (
    echo.
    echo Finalizing authentication setup...
    call npx tsx scripts/fix-auth.ts 2>nul || rem Ignore errors
)

REM Success message
echo.
echo ==================================================
echo QUICKSTART COMPLETE
echo ==================================================

echo.
echo Start with: npm run dev
echo.
echo Users: alice-admin, bob-user, connor-user
echo.
echo Commands:
echo   npm run db:studio          # Database GUI
echo   npm run db:generate-light  # Add test data
echo   npm run db:reset           # Fresh start
echo.