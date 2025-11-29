# Redis Provisioning Guide

## Overview
This guide provides step-by-step instructions for provisioning Redis as an external cache store for the hospitality management platform.

## Prerequisites
- Access to cloud infrastructure (AWS, Google Cloud, Azure, or Redis Cloud)
- Ability to set environment variables in Encore deployment
- Network connectivity between Encore services and Redis instance

## Option 1: Redis Cloud (Recommended for Quick Setup)

### Step 1: Create Redis Cloud Account
1. Visit https://redis.com/redis-enterprise-cloud/
2. Sign up for a free account (includes 30MB free tier)
3. Or choose a paid plan for production use

### Step 2: Create Redis Database
1. Click "New Database"
2. Select your cloud provider and region (choose closest to your Encore deployment)
3. Choose database size:
   - **Development**: 30MB (free tier)
   - **Staging**: 100MB - 1GB
   - **Production**: 1GB+ (recommended 4GB for 1M organizations)
4. Enable persistence (AOF or RDB)
5. Click "Activate"

### Step 3: Get Connection Details
1. Click on your database
2. Copy the following:
   - **Endpoint**: `redis-xxxxx.c12345.us-east-1-1.ec2.cloud.redislabs.com:12345`
   - **Password**: (shown in the security section)

### Step 4: Configure Encore Environment Variables
```bash
# Set in Encore dashboard or via CLI
encore secret set REDIS_HOST "redis-xxxxx.c12345.us-east-1-1.ec2.cloud.redislabs.com"
encore secret set REDIS_PORT "12345"
encore secret set REDIS_PASSWORD "your-password-here"
encore secret set REDIS_USE_TLS "true"
```

## Option 2: AWS ElastiCache

### Step 1: Create ElastiCache Cluster
```bash
# Via AWS Console or CLI
aws elasticache create-cache-cluster \
  --cache-cluster-id hospitality-redis \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --num-cache-nodes 1 \
  --cache-subnet-group-name your-subnet-group \
  --security-group-ids sg-xxxxxxxx
```

### Step 2: Configure Security Groups
1. Go to EC2 > Security Groups
2. Edit inbound rules for the Redis security group
3. Add rule: **Type**: Custom TCP, **Port**: 6379, **Source**: Encore service IPs

### Step 3: Get Connection Details
1. Go to ElastiCache > Redis clusters
2. Click on your cluster
3. Copy the **Primary Endpoint**

### Step 4: Configure Encore
```bash
encore secret set REDIS_HOST "your-cluster.xxxxx.use1.cache.amazonaws.com"
encore secret set REDIS_PORT "6379"
encore secret set REDIS_USE_TLS "false"  # ElastiCache in-VPC usually doesn't use TLS
```

## Option 3: Google Cloud Memorystore

### Step 1: Create Memorystore Instance
```bash
gcloud redis instances create hospitality-redis \
  --size=1 \
  --region=us-central1 \
  --tier=standard
```

### Step 2: Get Connection Details
```bash
gcloud redis instances describe hospitality-redis --region=us-central1
```

### Step 3: Configure Encore
```bash
encore secret set REDIS_HOST "10.0.0.3"  # Internal IP from describe command
encore secret set REDIS_PORT "6379"
encore secret set REDIS_USE_TLS "false"
```

## Option 4: Docker (Development Only)

### Step 1: Run Redis Container
```bash
docker run -d \
  --name hospitality-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine redis-server \
  --appendonly yes \
  --maxmemory 1gb \
  --maxmemory-policy allkeys-lru
```

### Step 2: Configure Encore
```bash
# For local development
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_USE_TLS=false
```

## Verification

### Test Redis Connection
After provisioning and configuring, verify the connection:

```bash
# 1. Check cache status endpoint
curl https://your-app.encr.app/cache/status

# 2. Check cache health
curl https://your-app.encr.app/cache/health

# Expected response:
{
  "healthy": true,
  "backend": "redis",
  "message": "Cache is healthy using redis backend"
}
```

### Monitor Redis Usage
```bash
# Check cache monitoring
curl https://your-app.encr.app/cache/status

# Look for:
# - type: "redis" (confirms Redis is being used)
# - available: true
# - redisInfo.connected: true
# - redisInfo.keys: <number of cached keys>
```

## Configuration Reference

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | Yes | - | Redis server hostname or IP |
| `REDIS_PORT` | No | 6379 | Redis server port |
| `REDIS_PASSWORD` | No | - | Redis authentication password |
| `REDIS_USE_TLS` | No | false | Enable TLS/SSL connection |
| `REDIS_MAX_RETRIES` | No | 3 | Maximum connection retry attempts |
| `REDIS_CONNECT_TIMEOUT` | No | 5000 | Connection timeout in milliseconds |

### Capacity Planning

For 1 million organizations:

**Cache Memory Requirements**:
- Daily reports: ~100 bytes per report × 1M orgs = ~100MB
- Balance data: ~200 bytes per balance × 1M orgs = ~200MB
- Summary data: ~150 bytes per summary × 1M orgs = ~150MB
- **Total**: ~450MB minimum, **Recommended**: 1-4GB with overhead

**Redis Instance Recommendations**:
- **Development**: 100MB - 1GB
- **Staging**: 1GB - 2GB
- **Production**: 4GB - 8GB

## Rollback to In-Memory Cache

If you need to rollback to in-memory caching:

```bash
# Remove Redis configuration
encore secret unset REDIS_HOST
encore secret unset REDIS_PORT
encore secret unset REDIS_PASSWORD
encore secret unset REDIS_USE_TLS

# The system will automatically fall back to in-memory cache
```

## Troubleshooting

### Connection Refused
- Check security group rules
- Verify Redis is running
- Confirm correct host and port

### Authentication Failed
- Verify `REDIS_PASSWORD` is correct
- Check if AUTH is enabled on Redis

### TLS/SSL Errors
- Set `REDIS_USE_TLS=true` for cloud providers
- Set `REDIS_USE_TLS=false` for local development

### High Memory Usage
- Increase Redis instance size
- Review TTL settings in `backend/config/runtime.ts`
- Consider enabling key eviction policies

## Cost Estimates

### Redis Cloud
- **Free Tier**: 30MB (good for development)
- **1GB**: ~$25/month
- **4GB**: ~$100/month

### AWS ElastiCache
- **cache.t3.micro**: ~$12/month (dev)
- **cache.r6g.large**: ~$150/month (production)

### Google Memorystore
- **1GB Standard**: ~$50/month
- **4GB Standard**: ~$200/month

## Support

For issues or questions:
1. Check the cache status endpoint: `/cache/status`
2. Review application logs for Redis connection errors
3. Verify environment variables are set correctly
4. Contact the DevOps team

## Next Steps

After provisioning Redis:
1. ✅ Verify connection using status endpoints
2. ✅ Monitor cache hit rates
3. ✅ Set up alerts for cache failures
4. ✅ Configure backup and persistence
5. ✅ Document in runbook

