# Deployment Guide

## Production Setup

### Prerequisites

- Docker and Docker Compose
- Domain name with DNS configured
- SSL certificates (Let's Encrypt)
- Server with 4GB+ RAM

### 1. Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repository
git clone <repo-url>
cd ai-workflow-platform
```

### 2. Configure Secrets

Create `secrets/` directory:

```bash
mkdir -p secrets

# Generate secrets
openssl rand -base64 32 > secrets/nextauth_secret.txt
openssl rand -base64 32 > secrets/db_password.txt

# Database URL
echo "postgresql://aiworkflow:$(cat secrets/db_password.txt)@postgres:5432/aiworkflow?schema=public" > secrets/database_url.txt

# Redis URL
echo "redis://redis:6379" > secrets/redis_url.txt
```

### 3. Configure Environment

Edit `docker-compose.prod.yml`:
- Update `NEXTAUTH_URL` with your domain
- Configure any additional environment variables

### 4. Deploy

```bash
# Build and start
docker compose -f docker-compose.prod.yml up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Seed database (first time only)
docker compose -f docker-compose.prod.yml exec app npx prisma db seed
```

### 5. SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d app.yourdomain.com

# Update nginx/default.conf to enable HTTPS
# Uncomment the HTTPS server block
```

### 6. Backup

```bash
# Manual backup
./scripts/backup.sh

# Automated daily backup (add to crontab)
0 2 * * * /path/to/ai-workflow-platform/scripts/backup.sh
```

## Monitoring

### Health Check

```bash
curl https://app.yourdomain.com/api/health
```

### Prometheus Metrics

```bash
curl https://app.yourdomain.com/api/metrics
```

### Logs

```bash
# View app logs
docker compose -f docker-compose.prod.yml logs -f app

# View all logs
docker compose -f docker-compose.prod.yml logs -f
```

## Scaling

### Horizontal Scaling

Increase replicas in `docker-compose.prod.yml`:

```yaml
app:
  deploy:
    replicas: 5
```

### Database Optimization

- Enable connection pooling in Prisma
- Add read replicas for heavy read workloads
- Configure PostgreSQL shared_buffers and work_mem

### Redis Optimization

- Configure maxmemory policy
- Use Redis Cluster for high availability

## Troubleshooting

### Container Won't Start

```bash
docker compose -f docker-compose.prod.yml logs app
```

### Database Connection Issues

```bash
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U aiworkflow
```

### Memory Issues

```bash
# Check memory usage
docker stats

# Increase limits in docker-compose.prod.yml
```
