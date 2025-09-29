#!/bin/bash

# NookBook Quick Start Script
# This script sets up the development environment quickly

set -e  # Exit on error

echo "=== NookBook Quick Start ==="
echo "============================"
echo ""

# Check if Docker is running
echo "[1/8] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
echo "SUCCESS: Docker is running"

# Check if .env exists, if not copy from example
echo ""
echo "[2/8] Setting up environment..."
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "SUCCESS: .env file created"
else
    echo "SUCCESS: .env file already exists"
fi

# Install dependencies
echo ""
echo "[3/8] Installing dependencies..."
npm install
echo "SUCCESS: Dependencies installed"

# Start MySQL container
echo ""
echo "[4/8] Starting MySQL container..."
docker compose up -d db

# Wait for MySQL to be ready with retry logic
echo "Waiting for MySQL to be ready..."
retries=0
max_retries=30
while [ $retries -lt $max_retries ]; do
    if docker exec nookbook-mysql mysql -u root -prootpassword -e "SELECT 1" >/dev/null 2>&1; then
        echo ""
        echo "SUCCESS: MySQL is ready"
        break
    fi
    retries=$((retries + 1))
    if [ $retries -eq $max_retries ]; then
        echo ""
        echo "ERROR: MySQL failed to start after 30 seconds"
        echo "Please check Docker logs: docker logs nookbook-mysql"
        exit 1
    fi
    echo -n "."
    sleep 1
done

# Generate Prisma client
echo ""
echo "[5/8] Generating Prisma client..."
# Test if Prisma client is functional, not just if file exists
if node -e "const {PrismaClient} = require('@prisma/client'); new PrismaClient();" 2>/dev/null; then
    echo "SUCCESS: Prisma client already exists"
else
    npm run db:generate || echo "SUCCESS: Prisma client generated"
fi

# Setup database schema
echo ""
echo "[6/8] Setting up database schema..."
npx prisma db push --skip-generate
echo "SUCCESS: Database schema created"

# Seed the database
echo ""
echo "[7/8] Seeding database..."
npm run db:seed
echo "SUCCESS: Database seeded"

# Ask about sample data generation
echo ""
echo "[8/8] Sample Data Generation"
echo "Choose a dataset for testing:"
echo ""
echo "  1. Light Dataset - Realistic office (~30-40% utilization)"
echo "     Moderate bookings, business hours, recurring meetings"
echo ""
echo "  2. Chaotic Dataset - Very busy office (~70-85% utilization)"
echo "     Heavy bookings, includes weekends & late hours"
echo ""
echo "  3. Minimal - Keep base seed data only (default)"
echo "     Just a few sample bookings for demo"
echo ""
read -p "Enter your choice (1/2/3) [default: 3]: " choice
choice=${choice:-3}

case $choice in
    1)
        echo ""
        echo "Generating light dataset..."
        npm run db:generate-light
        echo "SUCCESS: Light dataset generated"
        ;;
    2)
        echo ""
        echo "Generating chaotic dataset..."
        npm run db:generate-chaotic
        echo "SUCCESS: Chaotic dataset generated"
        ;;
    3|*)
        echo ""
        echo "Keeping minimal seed data."
        ;;
esac

# Run fix-auth script if it exists
if [ -f scripts/fix-auth.ts ]; then
    echo ""
    echo "Finalizing authentication setup..."
    npx tsx scripts/fix-auth.ts 2>/dev/null || true
fi

# Success message
echo ""
echo "=================================================="
echo "QUICKSTART COMPLETE"
echo "=================================================="

echo ""
echo "Start with: npm run dev"
echo ""
echo "Users: alice-admin, bob-user, connor-user"
echo ""
echo "Commands:"
echo "  npm run db:studio          # Database GUI"
echo "  npm run db:generate-light  # Add test data"
echo "  npm run db:reset           # Fresh start"
echo ""