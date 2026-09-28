# Universal CRM — Production Deployment Guide

This guide details the requirements, configuration, and step-by-step procedures for deploying Universal CRM to a production environment.

---

## 1. System Requirements

### Hardware Requirements:
- **Minimum**: 2 vCPUs, 4 GB RAM, 20 GB SSD storage.
- **Recommended**: 4 vCPUs, 8 GB RAM, 50 GB NVMe storage (supports up to 30,000 registered users).

### Software Prerequisites:
- **Operating System**: Ubuntu 22.04 LTS or modern Linux distribution.
- **Node.js**: v20.x LTS or higher.
- **Package Manager**: `npm` (v10+).
- **Database**: PostgreSQL 15 or 16.
- **Reverse Proxy**: Nginx 1.20+ with SSL/TLS (Let's Encrypt / Certbot).
- **Process Manager**: PM2 or systemd.

---

## 2. Environment Configuration (`.env`)

Create a `.env` file in the root of the application:

```bash
# ==============================================================================
# DATABASE (PostgreSQL 16)
# ==============================================================================
DATABASE_URL="postgresql://crm_user:StrongPasswordHere@localhost:5432/universal_crm_prod?schema=public&connection_limit=20"

# ==============================================================================
# APPLICATION & SECURITY
# ==============================================================================
NODE_ENV="production"
PORT=3000
APP_URL="https://crm.yourcompany.com"
AUTH_SECRET="generate-a-random-64-character-hex-string-for-cookie-encryption"

# ==============================================================================
# EMAIL DELIVERY (SMTP)
# ==============================================================================
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT=587
SMTP_USER="postmaster@crm.yourcompany.com"
SMTP_PASS="your-smtp-password"
EMAIL_FROM="Universal CRM <notifications@crm.yourcompany.com>"

# ==============================================================================
# RATE LIMITING & SECURITY
# ==============================================================================
RATE_LIMIT_LOGIN_ATTEMPTS=5
RATE_LIMIT_WINDOW_SECONDS=60
```

> [!WARNING]
> Never commit `.env` or production credentials into version control. Ensure proper file permissions on the production server (`chmod 600 .env`).

---

## 3. Database Initialization & Migration

Universal CRM uses Prisma ORM. On initial deployment or after schema updates:

```bash
# 1. Install project dependencies
npm ci --production=false

# 2. Generate Prisma Client bindings
npm run prisma:generate

# 3. Apply schema migrations
npx prisma db push
# or in a strict migration workflow:
# npx prisma migrate deploy

# 4. (Optional) Seed initial system roles and super admin
npm run seed
```

---

## 4. Production Build & Execution

Build the optimized Next.js 16 production bundle:

```bash
# 1. Verify TypeScript types
npm run type-check

# 2. Build the Next.js production bundle
npm run build

# 3. Test launch the application
npm run start
```

### Production Process Management with PM2:
Create an `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "universal-crm",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/var/www/universal-crm",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "1G",
      error_file: "/var/log/universal-crm/error.log",
      out_file: "/var/log/universal-crm/out.log",
    },
  ],
};
```

Start the service:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 5. Nginx Reverse Proxy & SSL Configuration

Configure `/etc/nginx/sites-available/crm.yourcompany.com`:

```nginx
server {
    listen 80;
    server_name crm.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/crm.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourcompany.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Static Assets Cache
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Health & Readiness Verification

Universal CRM provides two automated health check endpoints for load balancers and uptime monitors:

### 1. Liveness Probe (`/health`):
```bash
curl -i http://localhost:3000/health
# HTTP/1.1 200 OK
# Content-Type: application/json
# {"status":"ok","timestamp":"2026-09-17T14:30:00.000Z"}
```

### 2. Readiness Probe (`/ready`):
Performs an active database ping (`SELECT 1`) to verify database pool availability:
```bash
curl -i http://localhost:3000/ready
# HTTP/1.1 200 OK
# Content-Type: application/json
# {"status":"ready","checks":{"database":{"status":"ok"}}}
```

---

## 7. Database Backup & Disaster Recovery

Configure daily automated PostgreSQL dumps using a cron job:

```bash
#!/bin/bash
# /opt/scripts/backup-crm-db.sh
BACKUP_DIR="/var/backups/postgresql"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_NAME="universal_crm_prod"

mkdir -p $BACKUP_DIR
pg_dump -U crm_user -d $DATABASE_NAME -F c -b -v -f "$BACKUP_DIR/${DATABASE_NAME}_${TIMESTAMP}.dump"

# Retain backups for 14 days
find $BACKUP_DIR -name "*.dump" -mtime +14 -exec rm {} \;
```

Test restoration regularly:
```bash
pg_restore -U crm_user -d universal_crm_test -v /var/backups/postgresql/universal_crm_prod_*.dump
```
