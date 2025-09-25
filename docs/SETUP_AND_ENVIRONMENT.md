# NookBook - Setup and Environment Documentation

## Quick Start Guide

### Prerequisites

Ensure you have the following installed on your development machine:

| Software       | Minimum Version | Recommended Version | Check Command                       |
| -------------- | --------------- | ------------------- | ----------------------------------- |
| Node.js        | 18.17.0         | 20.11.0+            | `node --version`                    |
| npm/pnpm       | 9.0.0 / 8.0.0   | Latest              | `npm --version` or `pnpm --version` |
| Docker         | 20.10.0         | Latest              | `docker --version`                  |
| Docker Compose | 2.0.0           | Latest              | `docker compose version`            |
| Git            | 2.30.0          | Latest              | `git --version`                     |

### Initial Setup (5 minutes)

```bash
# 1. Clone the repository
git clone <repository-url> variance-cal
cd variance-cal

# 2. Install dependencies
npm install
# or if using pnpm
pnpm install

# 3. Set up environment variables
cp .env.example .env.local

# 4. Start the database
docker compose up -d

# 5. Initialize the database
npx prisma migrate dev
npx prisma db seed

# 6. Start the development server
npm run dev

# 7. Open the application
# Navigate to http://localhost:3000/dashboard/availability
```

## Environment Configuration

### Development Environment

Create a `.env.local` file in the project root:

```env
# Database Configuration
DATABASE_URL="mysql://root:nookbook_dev@localhost:3306/nookbook_dev"

# Application Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="NookBook"

# Mock Authentication (Development Only)
MOCK_AUTH_ENABLED="true"
DEFAULT_USER_ID="alice"

# Logging
LOG_LEVEL="debug"

# Feature Flags
ENABLE_ACTIVITY_LOG="true"
ENABLE_EMAIL_NOTIFICATIONS="false"
```

### Test Environment

Create a `.env.test` file:

```env
# Test Database (separate from development)
DATABASE_URL="mysql://root:nookbook_test@localhost:3307/nookbook_test"

# Test Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3001"
MOCK_AUTH_ENABLED="true"
DEFAULT_USER_ID="test_user"
LOG_LEVEL="error"
```

### Production Environment Variables

```env
# Production Database
DATABASE_URL="mysql://user:password@production-host:3306/nookbook_prod"

# Application
NEXT_PUBLIC_APP_URL="https://nookbook.example.com"
NEXT_PUBLIC_APP_NAME="NookBook"

# Authentication
MOCK_AUTH_ENABLED="false"
# Add real auth provider configs here

# Performance
DATABASE_CONNECTION_LIMIT="10"
DATABASE_POOL_TIMEOUT="20"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
LOG_LEVEL="info"

# Security
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_WINDOW="60000"
RATE_LIMIT_MAX_REQUESTS="100"
```

## Database Setup

### Local MySQL with Docker

The project includes a Docker Compose configuration for MySQL:

```yaml
# docker-compose.yml
version: "3.8"

services:
  db:
    image: mysql:8.0
    container_name: nookbook-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: nookbook_dev
      MYSQL_DATABASE: nookbook_dev
      MYSQL_USER: nookbook
      MYSQL_PASSWORD: nookbook_dev
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 5s
      retries: 10

  db_test:
    image: mysql:8.0
    container_name: nookbook-mysql-test
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: nookbook_test
      MYSQL_DATABASE: nookbook_test
    ports:
      - "3307:3306"
    volumes:
      - mysql_test_data:/var/lib/mysql

volumes:
  mysql_data:
  mysql_test_data:
```

### Database Management Commands

```bash
# Start database containers
docker compose up -d

# Stop database containers
docker compose down

# View database logs
docker compose logs -f db

# Access MySQL CLI
docker exec -it nookbook-mysql mysql -u root -p

# Reset database (caution!)
docker compose down -v
docker compose up -d
npx prisma migrate reset --force

# Backup database
docker exec nookbook-mysql mysqldump -u root -p nookbook_dev > backup.sql

# Restore database
docker exec -i nookbook-mysql mysql -u root -p nookbook_dev < backup.sql
```

### Prisma Commands

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name <migration-name>

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Seed database
npx prisma db seed

# Open Prisma Studio (GUI)
npx prisma studio

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

## Development Tools Setup

### VS Code Configuration

Recommended extensions (`.vscode/extensions.json`):

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens",
    "yoavbls.pretty-ts-errors"
  ]
}
```

VS Code settings (`.vscode/settings.json`):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]],
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  }
}
```

### Git Hooks Setup

Install husky for pre-commit hooks:

```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

Configure lint-staged (`.lintstagedrc.json`):

```json
{
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.prisma": ["npx prisma format"]
}
```

## Package Manager Configuration

### Using npm

```json
// .npmrc
engine-strict=true
save-exact=true
```

### Using pnpm

```yaml
# .pnpmfile.cjs
module.exports = {
  hooks: {
    readPackage(pkg) {
      // Package overrides if needed
      return pkg
    }
  }
}
```

```yaml
# pnpm-workspace.yaml (if using monorepo)
packages:
  - "packages/*"
  - "apps/*"
```

## Browser Requirements

Minimum supported browsers:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## System Architecture

### Port Allocations

| Service        | Development | Test | Production |
| -------------- | ----------- | ---- | ---------- |
| Next.js App    | 3000        | 3001 | 80/443     |
| MySQL Database | 3306        | 3307 | 3306       |
| Prisma Studio  | 5555        | -    | -          |

### Directory Permissions

Ensure proper permissions for development:

```bash
# Unix-like systems
chmod -R 755 .
chmod 600 .env*

# Windows (run as Administrator)
# Permissions are typically handled automatically
```

## Troubleshooting

### Common Setup Issues

#### Issue: Database connection refused

```bash
# Check if MySQL is running
docker compose ps

# Restart database
docker compose restart db

# Check logs
docker compose logs db
```

#### Issue: Port already in use

```bash
# Find process using port 3000
lsof -i :3000  # Unix
netstat -ano | findstr :3000  # Windows

# Kill the process or change port in .env.local
NEXT_PUBLIC_PORT=3001
```

#### Issue: Prisma client not generated

```bash
# Regenerate Prisma client
npx prisma generate

# Clear cache and reinstall
rm -rf node_modules/.prisma
npm install
```

#### Issue: TypeScript errors

```bash
# Check TypeScript version
npx tsc --version

# Run type check
npm run typecheck

# Clear TypeScript cache
rm -rf node_modules/.cache
```

### Environment Validation Script

Create `scripts/validate-env.js`:

```javascript
const required = {
  development: ["DATABASE_URL", "NEXT_PUBLIC_APP_URL"],
  production: ["DATABASE_URL", "NEXT_PUBLIC_APP_URL", "SENTRY_DSN"],
  test: ["DATABASE_URL"],
}

const env = process.env.NODE_ENV || "development"
const missing = required[env].filter(key => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`)
  process.exit(1)
}

console.log(`Environment validated for ${env}`)
```

## Performance Optimization

### Development Performance

```bash
# Enable SWC minification (faster than Terser)
# In next.config.js
module.exports = {
  swcMinify: true,
}

# Use Turbopack (experimental)
npm run dev -- --turbo
```

### Database Performance

```sql
-- Check slow queries
SHOW PROCESSLIST;

-- Analyze query performance
EXPLAIN SELECT * FROM bookings WHERE room_id = '...';

-- Monitor connections
SHOW STATUS WHERE variable_name = 'threads_connected';
```

## Security Checklist

- [ ] Never commit `.env` files
- [ ] Rotate database passwords regularly
- [ ] Use read-only database users where possible
- [ ] Enable SSL for production database connections
- [ ] Implement rate limiting for API endpoints
- [ ] Validate all user inputs
- [ ] Keep dependencies updated
- [ ] Use Content Security Policy headers
- [ ] Enable CORS appropriately
- [ ] Implement proper session management

## Monitoring & Logging

### Development Logging

```typescript
// lib/logger.ts
const log = {
  debug: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

if (process.env.LOG_LEVEL === "debug") {
  // Enable all logs
}
```

### Production Monitoring

- Use application monitoring (Sentry, DataDog)
- Set up database monitoring
- Configure uptime monitoring
- Implement health check endpoints
- Set up log aggregation

## Backup & Recovery

### Automated Backups

```bash
# Create backup script (scripts/backup.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec nookbook-mysql mysqldump -u root -p$DB_PASSWORD nookbook_dev > backups/backup_$DATE.sql
```

### Recovery Procedures

1. Stop application
2. Restore database from backup
3. Run any missing migrations
4. Verify data integrity
5. Restart application

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [MySQL 8.0 Reference](https://dev.mysql.com/doc/refman/8.0/en/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Support

For issues or questions:

1. Check this documentation
2. Review CLAUDE.md for product specifications
3. Check PROJECT_SETUP.md for coding conventions
4. Review WIP.md for current development status
