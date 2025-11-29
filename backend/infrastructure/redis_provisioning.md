# Redis Provisioning Guide

## Overview

This guide covers provisioning and configuring Redis for the hospitality management platform's distributed caching layer.

## Infrastructure Requirements

### Production Environment

- **Redis Version**: 7.0 or higher
- **Deployment Mode**: Redis Cluster or Managed Service (AWS ElastiCache, Azure Cache, Google Cloud Memorystore)
- **Memory**: Minimum 8GB RAM, recommended 16GB+ for 1M organizations
- **Persistence**: RDB + AOF for durability
- **Replication**: Master-replica setup with automatic failover

### Staging Environment

- **Redis Version**: 7.0 or higher
- **Deployment Mode**: Single instance or managed service
- **Memory**: 4GB RAM
- **Persistence**: RDB snapshots

### Development Environment

- **Redis Version**: 7.0 or higher
- **Deployment Mode**: Docker container or local installation
- **Memory**: 2GB RAM
- **Persistence**: Optional

## Installation Options

### Option 1: Docker (Recommended for Development)

```bash
# Create docker-compose.yml for Redis
docker-compose up -d redis

# Docker compose configuration:
# services:
#   redis:
#     image: redis:7.2-alpine
#     container_name: hospitality-redis
#     ports:
#       - "6379:6379"
#     volumes:
#       - redis-data:/data
#       - ./redis.conf:/usr/local/etc/redis/redis.conf
#     command: redis-server /usr/local/etc/redis/redis.conf
#     restart: unless-stopped
#     environment:
#       - REDIS_PASSWORD=your-secure-password
# 
# volumes:
#   redis-data:
```

### Option 2: AWS ElastiCache (Production)

```bash
# Create ElastiCache cluster using AWS CLI
aws elasticache create-replication-group \
  --replication-group-id hospitality-redis-prod \
  --replication-group-description "Hospitality Platform Redis Cluster" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.r7g.large \
  --num-cache-clusters 3 \
  --automatic-failover-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "your-secure-auth-token" \
  --snapshot-retention-limit 7 \
  --snapshot-window "03:00-05:00" \
  --preferred-maintenance-window "sun:05:00-sun:07:00"
```

### Option 3: Azure Cache for Redis (Production)

```bash
# Create Azure Cache using Azure CLI
az redis create \
  --name hospitality-redis-prod \
  --resource-group hospitality-rg \
  --location eastus \
  --sku Premium \
  --vm-size P1 \
  --enable-non-ssl-port false \
  --minimum-tls-version 1.2 \
  --redis-version 6
```

### Option 4: Google Cloud Memorystore (Production)

```bash
# Create Memorystore instance
gcloud redis instances create hospitality-redis-prod \
  --size=5 \
  --region=us-central1 \
  --redis-version=redis_7_0 \
  --tier=standard \
  --auth-enabled \
  --transit-encryption-mode=SERVER_AUTHENTICATION
```

## Redis Configuration

Create `redis.conf` with optimized settings:

```conf
# Network
bind 0.0.0.0
port 6379
protected-mode yes
requirepass your-secure-password

# Memory Management
maxmemory 8gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data

# AOF
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Replication (for replicas)
# replicaof master-host 6379
# masterauth master-password

# Performance
tcp-backlog 511
timeout 300
tcp-keepalive 300
databases 16

# Slow Log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Latency Monitor
latency-monitor-threshold 100

# Event Notification (for cache invalidation)
notify-keyspace-events "Ex"

# Client Output Buffer Limits
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Threading
io-threads 4
io-threads-do-reads yes
```

## Environment Variables

Add these to your environment configuration:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_USE_TLS=false  # Set to true in production
REDIS_DB=0
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3

# Cache Configuration
CACHE_DEFAULT_TTL=300  # 5 minutes
CACHE_MAX_ENTRIES=1000000  # 1M entries for 1M orgs
CACHE_EVICTION_POLICY=allkeys-lru
```

### Production Environment Variables

```bash
# AWS ElastiCache
REDIS_HOST=hospitality-redis-prod.xxxxx.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-elasticache-auth-token
REDIS_USE_TLS=true

# Azure Cache
REDIS_HOST=hospitality-redis-prod.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=your-azure-primary-key
REDIS_USE_TLS=true

# Google Cloud Memorystore
REDIS_HOST=10.0.0.3  # Internal IP
REDIS_PORT=6379
REDIS_PASSWORD=your-memorystore-auth-string
REDIS_USE_TLS=false  # Memorystore uses VPC, not TLS
```

## Cache Manager Integration

The cache manager automatically detects and uses Redis when `REDIS_HOST` is set:

```typescript
// backend/cache/redis_cache_service.ts automatically:
// 1. Detects REDIS_HOST environment variable
// 2. Connects to Redis using ioredis
// 3. Falls back to in-memory cache if Redis unavailable
// 4. Provides transparent caching API
```

## Verification

### Test Redis Connection

```bash
# Test basic connectivity
redis-cli -h localhost -p 6379 -a your-secure-password PING
# Expected: PONG

# Check Redis info
redis-cli -h localhost -p 6379 -a your-secure-password INFO

# Monitor cache operations
redis-cli -h localhost -p 6379 -a your-secure-password MONITOR
```

### Test Application Integration

```bash
# Check cache stats via API
curl http://localhost:4000/cache-service/stats

# Expected response:
# {
#   "type": "redis",
#   "available": true,
#   "memoryEntries": 0,
#   "redisInfo": {
#     "connected": true,
#     "keys": 0
#   }
# }
```

## Monitoring

### Key Metrics to Monitor

1. **Memory Usage**
   - `used_memory`
   - `used_memory_peak`
   - `mem_fragmentation_ratio`

2. **Performance**
   - `instantaneous_ops_per_sec`
   - `hit_rate` (calculated from `keyspace_hits` / `keyspace_misses`)
   - `evicted_keys`

3. **Connections**
   - `connected_clients`
   - `blocked_clients`
   - `rejected_connections`

4. **Replication**
   - `connected_slaves`
   - `master_repl_offset`
   - `repl_backlog_size`

### Monitoring Commands

```bash
# Memory stats
redis-cli INFO memory

# Performance stats
redis-cli INFO stats

# Replication status
redis-cli INFO replication

# Slow queries
redis-cli SLOWLOG GET 10

# Client connections
redis-cli CLIENT LIST
```

## Scaling Considerations

### Horizontal Scaling (Redis Cluster)

For 1M+ organizations, consider Redis Cluster:

```bash
# Create 6-node cluster (3 masters, 3 replicas)
redis-cli --cluster create \
  redis-node-1:6379 \
  redis-node-2:6379 \
  redis-node-3:6379 \
  redis-node-4:6379 \
  redis-node-5:6379 \
  redis-node-6:6379 \
  --cluster-replicas 1
```

Update environment variables:

```bash
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=redis-node-1:6379,redis-node-2:6379,redis-node-3:6379
```

### Vertical Scaling

Memory sizing guide:

- **100K orgs**: 4GB RAM
- **500K orgs**: 8GB RAM
- **1M orgs**: 16GB RAM
- **5M+ orgs**: 32GB+ RAM or cluster

## Backup and Recovery

### Automated Backups

```bash
# RDB snapshot (configured in redis.conf)
# Automatic snapshots: every 60s if 10000+ keys changed

# Manual snapshot
redis-cli BGSAVE

# Copy snapshot
cp /var/lib/redis/dump.rdb /backup/dump-$(date +%Y%m%d-%H%M%S).rdb
```

### AOF Backups

```bash
# AOF is continuously written
# Backup AOF file
cp /var/lib/redis/appendonly.aof /backup/appendonly-$(date +%Y%m%d-%H%M%S).aof
```

### Recovery

```bash
# Stop Redis
systemctl stop redis

# Restore RDB snapshot
cp /backup/dump-20241107.rdb /var/lib/redis/dump.rdb

# Restore AOF (if used)
cp /backup/appendonly-20241107.aof /var/lib/redis/appendonly.aof

# Start Redis
systemctl start redis
```

## Security Checklist

- [ ] Set strong `requirepass` password
- [ ] Enable TLS/SSL in production
- [ ] Use VPC/Private network (no public internet access)
- [ ] Enable authentication tokens (AWS ElastiCache)
- [ ] Configure firewall rules (only allow app servers)
- [ ] Enable encryption at rest
- [ ] Enable encryption in transit
- [ ] Regular security updates
- [ ] Monitor failed authentication attempts
- [ ] Use separate Redis instances for prod/staging/dev

## Troubleshooting

### Connection Issues

```bash
# Test network connectivity
telnet redis-host 6379

# Check firewall rules
iptables -L | grep 6379

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

### Performance Issues

```bash
# Check slow queries
redis-cli SLOWLOG GET 100

# Check memory fragmentation
redis-cli INFO memory | grep fragmentation

# Check eviction stats
redis-cli INFO stats | grep evicted
```

### Memory Issues

```bash
# Check memory usage
redis-cli INFO memory

# Check biggest keys
redis-cli --bigkeys

# Force eviction if needed
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Next Steps

1. Install ioredis dependency: `bun install ioredis`
2. Set up Redis infrastructure (Docker/Cloud)
3. Configure environment variables
4. Restart application
5. Verify cache stats endpoint shows Redis connected
6. Monitor cache hit rates and performance

## Support

- Redis Documentation: https://redis.io/docs/
- ioredis Documentation: https://github.com/redis/ioredis
- Cloud Provider Docs:
  - AWS ElastiCache: https://docs.aws.amazon.com/elasticache/
  - Azure Cache: https://docs.microsoft.com/azure/redis-cache/
  - Google Memorystore: https://cloud.google.com/memorystore/docs/redis

