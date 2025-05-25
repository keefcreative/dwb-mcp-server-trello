# 🚀 DWB MCP Trello Server Deployment Strategy

## Overview

This guide covers deployment options for your DWB MCP Trello Server to production environments. Three platforms are evaluated: Render.com, Railway.app, and Fly.io, each with different strengths and use cases.

## 🎯 Deployment Goals

- Deploy MCP server to production with high availability
- Secure environment variable management
- Health monitoring and logging
- Easy rollbacks and updates
- Cost-effective scaling

## 📊 Platform Comparison

| Feature | Render.com | Railway.app | Fly.io |
|---------|------------|-------------|---------|
| **Deployment** | Git + Docker | Git-based | Docker + CLI |
| **Free Tier** | 750 hours/month | $5 credit | Limited free |
| **Scaling** | Auto-scaling | Manual/Auto | Global edge |
| **Databases** | PostgreSQL | Built-in DBs | External |
| **SSL** | Automatic | Automatic | Automatic |
| **Custom Domains** | ✅ | ✅ | ✅ |
| **Monitoring** | Basic | Good | Advanced |
| **Learning Curve** | Easy | Easy | Moderate |

## 🏗️ Pre-Deployment Setup

### 1. Prepare Repository

Ensure your repository has these files:

```bash
dwb-trello-mcp/
├── Dockerfile                 # ✅ Already exists
├── docker-compose.yml         # ✅ Already exists
├── .dockerignore             # ✅ Already exists
├── package.json              # ✅ Already exists
└── deployment/               # Create this directory
    ├── render.yaml
    ├── railway.toml
    └── fly.toml
```

### 2. Environment Variables Template

Create `.env.production.example`:

```env
# Trello API Configuration
TRELLO_API_KEY=your-production-api-key
TRELLO_TOKEN=your-production-token
TRELLO_BOARD_ID=your-default-board-id
TRELLO_ORG_ID=your-organization-id

# Server Configuration
NODE_ENV=production
PORT=3001

# Optional: Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

### 3. Update Dockerfile for Production

Optimize your existing Dockerfile:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner

WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 mcpserver

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/templates ./templates

USER mcpserver

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "build/index.js"]
```

## 🌐 Render.com Deployment

### Pros
- Easiest deployment process
- Automatic SSL certificates
- Good free tier (750 hours/month)
- Automatic deploys from Git
- Built-in monitoring

### Cons
- Limited customization
- Can be slower than other options
- Less control over infrastructure

### Setup Steps

1. **Create `deployment/render.yaml`:**

```yaml
services:
  - type: web
    name: dwb-trello-mcp
    env: docker
    dockerfilePath: ./Dockerfile
    plan: starter
    region: oregon
    branch: main
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: TRELLO_API_KEY
        sync: false
      - key: TRELLO_TOKEN
        sync: false
      - key: TRELLO_BOARD_ID
        sync: false
      - key: TRELLO_ORG_ID
        sync: false
```

2. **Deploy to Render:**

```bash
# Push to GitHub first
git add .
git commit -m "Add Render deployment config"
git push origin main

# Then connect repository in Render dashboard
# 1. Go to https://render.com
# 2. Connect your GitHub repository
# 3. Select "dwb-trello-mcp"
# 4. Choose "Web Service"
# 5. Configure environment variables
# 6. Deploy
```

3. **Environment Variables in Render:**
   - Go to your service dashboard
   - Navigate to "Environment" tab
   - Add all required variables from `.env.production.example`

### Render Monitoring

```bash
# View logs
render logs --service dwb-trello-mcp

# Check service status
curl https://your-app-name.onrender.com/health
```

## 🚂 Railway.app Deployment

### Pros
- Excellent developer experience
- Git-based deployment
- Built-in databases available
- Good monitoring dashboard
- Reasonable pricing

### Cons
- No free tier (starts at $5/month)
- Less global presence than Fly.io

### Setup Steps

1. **Create `deployment/railway.toml`:**

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[[deploy.environmentVariables]]
name = "NODE_ENV"
value = "production"

[[deploy.environmentVariables]]
name = "PORT"
value = "3001"
```

2. **Deploy to Railway:**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Set environment variables
railway variables set TRELLO_API_KEY=your-key
railway variables set TRELLO_TOKEN=your-token
railway variables set TRELLO_BOARD_ID=your-board-id
railway variables set TRELLO_ORG_ID=your-org-id

# Deploy
railway up
```

3. **Custom Domain (Optional):**

```bash
# Add custom domain
railway domain add your-domain.com
```

### Railway Monitoring

```bash
# View logs
railway logs

# Check deployment status
railway status

# Open in browser
railway open
```

## ✈️ Fly.io Deployment

### Pros
- Global edge deployment
- Excellent performance
- Advanced networking features
- Great for high-traffic applications
- Powerful CLI tools

### Cons
- Steeper learning curve
- More complex configuration
- Limited free tier

### Setup Steps

1. **Create `deployment/fly.toml`:**

```toml
app = "dwb-trello-mcp"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[vm]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512

[[vm.mounts]]
  source = "data"
  destination = "/app/data"
```

2. **Deploy to Fly.io:**

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly
fly auth login

# Initialize app
fly launch --no-deploy

# Set secrets (environment variables)
fly secrets set TRELLO_API_KEY=your-key
fly secrets set TRELLO_TOKEN=your-token
fly secrets set TRELLO_BOARD_ID=your-board-id
fly secrets set TRELLO_ORG_ID=your-org-id

# Deploy
fly deploy
```

3. **Scale and Monitor:**

```bash
# Scale to multiple regions
fly scale count 2 --region sjc,iad

# Monitor performance
fly logs
fly status
fly metrics
```

### Fly.io Advanced Features

```bash
# Set up custom domain
fly certs add your-domain.com

# Configure autoscaling
fly autoscale set min=1 max=3

# Set up monitoring
fly dashboard
```

## 🔒 Security Best Practices

### Environment Variables
- Never commit secrets to Git
- Use platform-specific secret management
- Rotate API keys regularly
- Use different keys for staging/production

### Network Security
```bash
# For Fly.io - restrict access
fly ips allocate-v4 --shared
fly ips allocate-v6

# Configure firewall rules if needed
```

### Monitoring & Alerting

1. **Health Checks:**
```javascript
// Add to your MCP server
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime()
  });
});
```

2. **Error Tracking (Optional):**
```bash
# Add Sentry for error tracking
npm install @sentry/node

# Configure in your app
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

## 📊 Cost Comparison

### Monthly Costs (Estimated)

| Platform | Free Tier | Starter Plan | Production Plan |
|----------|-----------|--------------|-----------------|
| **Render** | 750 hours free | $7/month | $25/month |
| **Railway** | $5 credit | $5/month | $20/month |
| **Fly.io** | Limited free | $5-10/month | $15-30/month |

### Recommendations by Use Case

- **Development/Testing**: Render.com (free tier)
- **Small Production**: Railway.app (best DX)
- **High Traffic/Global**: Fly.io (performance)

## 🚀 Deployment Workflow

### Recommended Git Workflow

```bash
# 1. Create deployment branch
git checkout -b deployment/production

# 2. Add deployment configs
git add deployment/
git commit -m "Add deployment configurations"

# 3. Push and deploy
git push origin deployment/production

# 4. Merge to main after testing
git checkout main
git merge deployment/production
git push origin main
```

### CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-render:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Render
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"

  deploy-railway:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          npx @railway/cli deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## 🔧 Troubleshooting

### Common Issues

1. **Build Failures:**
```bash
# Check build logs
docker build -t test-build .
docker run --rm test-build

# Test locally first
pnpm run build
node build/index.js
```

2. **Environment Variable Issues:**
```bash
# Verify variables are set
printenv | grep TRELLO

# Test with curl
curl -H "Authorization: Bearer $TRELLO_TOKEN" \
  "https://api.trello.com/1/members/me"
```

3. **Health Check Failures:**
```bash
# Test health endpoint
curl -f http://localhost:3001/health

# Check server logs
docker logs container-name
```

### Platform-Specific Debugging

**Render:**
```bash
# View build logs in dashboard
# Check environment variables
# Monitor resource usage
```

**Railway:**
```bash
railway logs --tail
railway shell
railway variables
```

**Fly.io:**
```bash
fly logs
fly ssh console
fly status --all
```

## 📈 Monitoring & Maintenance

### Key Metrics to Monitor
- Response time for `/health` endpoint
- Memory usage
- CPU utilization
- Error rates
- Trello API rate limits

### Maintenance Tasks
- Regular dependency updates
- Security patches
- Log rotation
- Performance optimization
- Cost optimization

### Backup Strategy
- Environment variables backup
- Configuration files in Git
- Database backups (if applicable)
- Disaster recovery plan

## 🎯 Next Steps

1. **Choose Your Platform** based on requirements and budget
2. **Set up staging environment** first
3. **Configure monitoring** and alerting
4. **Test deployment** thoroughly
5. **Document runbooks** for operations team
6. **Plan scaling strategy** for growth

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Fly.io Documentation](https://fly.io/docs)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Production Checklist](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)