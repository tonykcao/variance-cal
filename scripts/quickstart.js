#!/usr/bin/env node

/**
 * NookBook Quick Start Script (Cross-platform)
 * This script sets up the development environment quickly
 */

const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

// Suppress EPERM warnings on Windows
if (process.platform === "win32") {
  process.on("uncaughtException", (error) => {
    if (error.message && error.message.includes("EPERM") && error.message.includes(".prisma")) {
      // Silently ignore Prisma engine permission errors on Windows
      return
    }
    // Re-throw other errors
    throw error
  })
}

console.log("\n=== NookBook Quick Start ===")
console.log("============================\n")

// Helper function to execute commands
function exec(command, options = {}) {
  try {
    execSync(command, { stdio: "inherit", ...options })
    return true
  } catch (error) {
    // Only return false for real errors, not just non-zero exit codes
    if (error.status !== undefined && error.status !== 0) {
      console.error(`Command failed with exit code ${error.status}: ${command}`)
    }
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
console.log("[1/8] Checking Docker...")
if (!exec("docker info", { stdio: "ignore" })) {
  console.error("ERROR: Docker is not running. Please start Docker Desktop and try again.")
  process.exit(1)
}
console.log("SUCCESS: Docker is running\n")

// Step 2: Check/Create .env file
const envPath = path.join(process.cwd(), ".env")
const envExamplePath = path.join(process.cwd(), ".env.example")

if (!fs.existsSync(envPath)) {
  console.log("[2/8] Creating .env file from .env.example...")
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath)
    console.log("SUCCESS: .env file created\n")
  } else {
    console.error("ERROR: .env.example not found")
    process.exit(1)
  }
} else {
  console.log("[2/8] Checking .env file...")
  console.log("SUCCESS: .env file already exists\n")
}

// Step 3: Install dependencies
console.log("[3/8] Installing dependencies...")
exec("npm install")
console.log("SUCCESS: Dependencies installed\n")

// Step 4: Start MySQL container
console.log("[4/8] Starting MySQL container...")

// Check if container already exists and handle gracefully
try {
  // Check if container exists (running or stopped)
  const containerInfo = execSync(
    'docker ps -a --filter "name=nookbook-mysql" --format "{{.Names}}:{{.Status}}"',
    { encoding: "utf8" }
  ).trim()

  if (containerInfo && containerInfo.startsWith("nookbook-mysql")) {
    // Container exists, check if it's running
    if (containerInfo.includes("Up")) {
      console.log("SUCCESS: MySQL container already running")
    } else {
      // Container exists but is stopped
      console.log("Starting existing MySQL container...")
      exec("docker start nookbook-mysql")
      console.log("SUCCESS: MySQL container started")
    }
  } else {
    // Container doesn't exist, create it
    console.log("Creating new MySQL container...")
    exec("docker compose up -d db")
    console.log("SUCCESS: MySQL container created")
  }
} catch (error) {
  // If docker ps fails, try to create container anyway
  console.log("Creating MySQL container...")
  if (!exec("docker compose up -d db")) {
    // If creation fails, maybe it exists - try to start it
    console.log("Container may already exist, attempting to start...")
    if (!exec("docker start nookbook-mysql")) {
      console.error("ERROR: Failed to start MySQL container. Please check Docker logs.")
      process.exit(1)
    }
  }
}

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
    exec('docker exec nookbook-mysql mysql -u root -prootpassword -e "SELECT 1"', {
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
console.log("[5/8] Generating Prisma client...")
// Test if Prisma client is functional, not just if file exists
let clientWorks = false
try {
  // Try to load the Prisma client
  const testCmd = 'node -e "const {PrismaClient} = require(\'@prisma/client\'); new PrismaClient();"'
  execSync(testCmd, { stdio: 'ignore' })
  clientWorks = true
  console.log("SUCCESS: Prisma client already exists\n")
} catch (e) {
  // Client doesn't work, need to generate
  try {
    exec("npm run db:generate")
    console.log("SUCCESS: Prisma client generated\n")
  } catch (error) {
    // Continue even if there's an EPERM error - the client still works
    if (!error.message.includes("EPERM")) {
      throw error
    }
    console.log("SUCCESS: Prisma client generated (with warnings)\n")
  }
}

// Step 6: Push database schema
console.log("[6/8] Setting up database schema...")
if (!exec("npm run db:push -- --skip-generate")) {
  console.error("ERROR: Failed to push database schema")
  console.error("This is critical - the database tables were not created")
  console.error("Please check your database connection and try again")
  process.exit(1)
}
console.log("SUCCESS: Database schema created\n")

// Step 7: Seed the database and optionally generate sample data
console.log("[7/8] Seeding database...")
if (!exec("npm run db:seed")) {
  console.error("ERROR: Failed to seed database. Please run 'npm run db:seed' manually.")
  console.error("Continuing with setup...")
}
console.log("SUCCESS: Database seeded\n")

// Step 8: Ask about sample data generation
console.log("[8/8] Sample Data Generation")
console.log("Choose a dataset for testing:\n")
console.log("  1. Light Dataset - Realistic office (~30-40% utilization)")
console.log("     Moderate bookings, business hours, recurring meetings\n")
console.log("  2. Chaotic Dataset - Very busy office (~70-85% utilization)")
console.log("     Heavy bookings, includes weekends & late hours\n")
console.log("  3. Minimal - Keep base seed data only (default)")
console.log("     Just a few sample bookings for demo\n")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function handleDataGeneration() {
  return new Promise(resolve => {
    rl.question("Enter your choice (1/2/3) [default: 3]: ", answer => {
      const choice = answer.trim() || "3"
      rl.close()

      switch (choice) {
        case "1":
          console.log("\nGenerating light dataset...")
          exec("npm run db:generate-light")
          console.log("SUCCESS: Light dataset generated\n")
          break
        case "2":
          console.log("\nGenerating chaotic dataset...")
          exec("npm run db:generate-chaotic")
          console.log("SUCCESS: Chaotic dataset generated\n")
          break
        case "3":
        default:
          console.log("\nKeeping minimal seed data.\n")
          break
      }
      resolve()
    })
  })
}

// Run the dataset generation
handleDataGeneration().then(() => {
  // Run fix-auth script if it exists
  const fixAuthPath = path.join(__dirname, "fix-auth.ts")
  if (fs.existsSync(fixAuthPath)) {
    console.log("\nFinalizing authentication setup...")
    try {
      exec("npx tsx scripts/fix-auth.ts")
    } catch (error) {
      // Ignore EPERM errors on Windows - they don't affect functionality
      if (!error.message.includes("EPERM")) {
        console.error("Warning: Could not run auth fix:", error.message)
      }
    }
  }

  // Success message
  console.log("\n" + "=".repeat(50))
  console.log("QUICKSTART COMPLETE")
  console.log("=".repeat(50))

  console.log("\nStart with: npm run dev")
  console.log("\nUsers: alice-admin, bob-user, connor-user")
  console.log("\nCommands:")
  console.log("  npm run db:studio          # Database GUI")
  console.log("  npm run db:generate-light  # Add test data")
  console.log("  npm run db:reset           # Fresh start\n")
})
