#!/bin/bash

# NookBook Quick Start Script
# This script sets up the development environment quickly

set -e  # Exit on error

echo "=== NookBook Quick Start ==="
echo "============================"
echo ""

# Check if Docker is running
echo "[1/7] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
echo "SUCCESS: Docker is running"

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "[2/7] Creating .env file from .env.example..."
    cp .env.example .env
    echo "SUCCESS: .env file created"
else
    echo "SUCCESS: .env file already exists"
fi

# Install dependencies
echo ""
echo "[3/7] Installing dependencies..."
npm install
echo "SUCCESS: Dependencies installed"

# Start MySQL container
echo ""
echo "[4/7] Starting MySQL container..."
docker compose up -d db
echo "Waiting for MySQL to be ready..."
sleep 10  # Give MySQL time to initialize

# Generate Prisma client
echo ""
echo "[5/7] Generating Prisma client..."
npm run db:generate
echo "SUCCESS: Prisma client generated"

# Run migrations
echo ""
echo "[6/7] Running database migrations..."
npm run db:migrate -- --name init
echo "SUCCESS: Database migrations complete"

# Seed the database
echo ""
echo "[7/7] Seeding database..."
npm run db:seed
echo "SUCCESS: Database seeded"

# Success message
echo ""
echo "=== SETUP COMPLETE ==="
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
echo "Available users for testing:"
echo "  - alice-user (User)"
echo "  - bob-user (User)"
echo "  - connor-admin (Admin)"
echo ""
echo "The app will be available at: http://localhost:3000"
echo "Prisma Studio (database viewer): npm run db:studio"