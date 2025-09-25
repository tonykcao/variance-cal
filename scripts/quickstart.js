#!/usr/bin/env node

/**
 * NookBook Quick Start Script (Cross-platform)
 * This script sets up the development environment quickly
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

console.log("\n=== NookBook Quick Start ===")
console.log("============================\n")

// Helper function to execute commands
function exec(command, options = {}) {
  try {
    execSync(command, { stdio: "inherit", ...options })
    return true
  } catch (error) {
    return false
  }
}

// Helper function to check command availability
function commandExists(command) {
  try {
    execSync(`${command} --version`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

// Step 1: Check Docker
console.log("[1/7] Checking Docker...")
if (!exec("docker info", { stdio: "ignore" })) {
  console.error("ERROR: Docker is not running. Please start Docker Desktop and try again.")
  process.exit(1)
}
console.log("SUCCESS: Docker is running\n")

// Step 2: Check/Create .env file
const envPath = path.join(process.cwd(), ".env")
const envExamplePath = path.join(process.cwd(), ".env.example")

if (!fs.existsSync(envPath)) {
  console.log("[2/7] Creating .env file from .env.example...")
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath)
    console.log("SUCCESS: .env file created\n")
  } else {
    console.error("ERROR: .env.example not found")
    process.exit(1)
  }
} else {
  console.log("SUCCESS: .env file already exists\n")
}

// Step 3: Install dependencies
console.log("[3/7] Installing dependencies...")
exec("npm install")
console.log("SUCCESS: Dependencies installed\n")

// Step 4: Start MySQL container
console.log("[4/7] Starting MySQL container...")
exec("docker compose up -d db")
console.log("Waiting for MySQL to be ready...")

// Wait for MySQL to be ready (with retries)
let mysqlReady = false
let retries = 0
const maxRetries = 30

while (!mysqlReady && retries < maxRetries) {
  retries++
  process.stdout.write(".")

  // Try to connect to MySQL
  if (
    exec('docker compose exec -T db mysql -u root -prootpassword -e "SELECT 1"', {
      stdio: "ignore",
    })
  ) {
    mysqlReady = true
  } else {
    // Wait 1 second before retrying
    execSync("sleep 1 2>nul || timeout /t 1 >nul 2>&1", { stdio: "ignore" })
  }
}

console.log("")
if (mysqlReady) {
  console.log("SUCCESS: MySQL is ready\n")
} else {
  console.error("ERROR: MySQL failed to start. Please check Docker logs.")
  process.exit(1)
}

// Step 5: Generate Prisma client
console.log("[5/7] Generating Prisma client...")
exec("npm run db:generate")
console.log("SUCCESS: Prisma client generated\n")

// Step 6: Run migrations
console.log("[6/7] Running database migrations...")
exec("npx prisma migrate dev --name init")
console.log("SUCCESS: Database migrations complete\n")

// Step 7: Seed the database
console.log("[7/7] Seeding database...")
exec("npm run db:seed")
console.log("SUCCESS: Database seeded\n")

// Success message
console.log("\n=== SETUP COMPLETE ===\n")
console.log("To start the development server, run:")
console.log("  npm run dev\n")
console.log("Available users for testing:")
console.log("  - alice-user (User)")
console.log("  - bob-user (User)")
console.log("  - connor-admin (Admin)\n")
console.log("The app will be available at: http://localhost:3000")
console.log("Prisma Studio (database viewer): npm run db:studio")
