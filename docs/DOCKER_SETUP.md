# Docker Installation Guide for NookBook

## Windows Installation

### Option 1: Docker Desktop (Recommended)

1. **Download Docker Desktop**
   - Go to: https://www.docker.com/products/docker-desktop/
   - Click "Download for Windows"
   - Run the installer

2. **System Requirements**
   - Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
   - Windows 11 64-bit
   - Enable WSL 2 feature
   - 4GB system RAM minimum

3. **Installation Steps**

   ```powershell
   # 1. Enable WSL 2 (Run as Administrator in PowerShell)
   wsl --install

   # 2. Restart your computer

   # 3. Install Docker Desktop from the downloaded installer

   # 4. Start Docker Desktop from Start Menu

   # 5. Verify installation
   docker --version
   docker compose version
   ```

4. **Post-Installation**
   - Docker Desktop will start automatically on login
   - Look for the Docker whale icon in system tray
   - Right-click icon → "Settings" to configure resources

### Option 2: Docker via WSL2 (Advanced)

If you prefer not to use Docker Desktop:

```bash
# In WSL2 Ubuntu
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect
```

## Mac Installation

1. **Download Docker Desktop for Mac**
   - Intel chip: https://desktop.docker.com/mac/main/amd64/Docker.dmg
   - Apple Silicon: https://desktop.docker.com/mac/main/arm64/Docker.dmg

2. **Install**

   ```bash
   # Or via Homebrew
   brew install --cask docker
   ```

3. **Start Docker Desktop**
   - Open Docker from Applications
   - Follow the setup wizard

## Linux Installation

### Ubuntu/Debian

```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

## Verify Installation

After installation, verify Docker is working:

```bash
# Check Docker version
docker --version

# Check Docker Compose
docker compose version

# Test Docker
docker run hello-world
```

## Troubleshooting

### Windows Issues

1. **WSL 2 not installed**

   ```powershell
   wsl --install
   # Restart computer
   ```

2. **Virtualization not enabled**
   - Enter BIOS/UEFI settings
   - Enable Intel VT-x or AMD-V
   - Save and restart

3. **Docker Desktop won't start**
   - Right-click Docker Desktop icon
   - Select "Troubleshoot"
   - Click "Reset to factory defaults"

### General Issues

1. **Permission denied**

   ```bash
   # Add user to docker group (Linux/Mac)
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

2. **Port already in use**

   ```bash
   # Find process using port 3306
   netstat -ano | findstr :3306  # Windows
   lsof -i :3306                  # Mac/Linux

   # Kill the process or change MySQL port in docker-compose.yml
   ```

## Alternative: Use Cloud Database

If you cannot install Docker, you can use a cloud MySQL service:

1. **PlanetScale** (Free tier available)
   - Sign up at: https://planetscale.com
   - Create database
   - Get connection string
   - Update `.env` file with connection string

2. **Railway** (Free tier available)
   - Sign up at: https://railway.app
   - Create MySQL service
   - Get connection string
   - Update `.env` file

3. **Local MySQL** (Without Docker)
   - Download MySQL Community Server: https://dev.mysql.com/downloads/
   - Install and configure
   - Create database: `CREATE DATABASE nookbook;`
   - Update `.env` with local connection

## Next Steps

Once Docker is installed and running:

```bash
# Run the quickstart script
npm run quickstart

# Or manually start MySQL
docker compose up -d

# Then run migrations and seed
npm run db:migrate
npm run db:seed
```

## Resources

- Docker Documentation: https://docs.docker.com/
- Docker Desktop Troubleshooting: https://docs.docker.com/desktop/troubleshooting/
- WSL 2 Documentation: https://docs.microsoft.com/en-us/windows/wsl/
