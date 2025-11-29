# Redis Infrastructure Setup for 1M Organizations

## Overview
This guide provides multiple options for setting up Redis infrastructure to support the 1M Organization Cache & Data Consistency System.

## Option 1: Encore Built-in Cache (Current Implementation) ✅

**Status**: Already implemented and working
**Pros**: 
- No external dependencies
- Integrated with Encore's infrastructure
- Automatic scaling
- Built-in monitoring

**Current Implementation**:
- Uses in-memory Map with intelligent TTL
- Distributed across Encore services
- Automatic expiration based on data recency
- High performance for 1M organizations

## Option 2: External Redis Cloud Service

### 2.1 Redis Cloud (Recommended for Production)

**Setup Steps**:

1. **Create Redis Cloud Account**:
   ```bash
   # Visit: https://redis.com/redis-enterprise-cloud/
   # Sign up for Redis Cloud account
   ```

2. **Create Redis Database**:
   - Choose "Redis Stack" for advanced features
   - Select region closest to your users
   - Choose plan: "Fixed" for predictable costs or "Flexible" for auto-scaling
   - Recommended: 1GB+ memory for 1M organizations

3. **Get Connection Details**:
   ```bash
   # From Redis Cloud dashboard, get:
   # - Endpoint: your-db.redis-cloud.com:12345
   # - Password: your-password
   # - SSL: Enabled
   ```

4. **Update Encore Configuration**:
   ```typescript
   // backend/cache/redis_config.ts
   export const REDIS_CONFIG = {
     host: process.env.REDIS_HOST || 'your-db.redis-cloud.com',
     port: parseInt(process.env.REDIS_PORT || '12345'),
     password: process.env.REDIS_PASSWORD,
     ssl: true,
     retryDelayOnFailover: 100,
     maxRetriesPerRequest: 3,
     lazyConnect: true
   };
   ```

### 2.2 AWS ElastiCache Redis

**Setup Steps**:

1. **Create ElastiCache Cluster**:
   ```bash
   # AWS Console > ElastiCache > Redis
   # Choose: Redis (cluster mode disabled) for simplicity
   # Node type: cache.r6g.large (2 vCPU, 12.3 GB RAM)
   # Multi-AZ: Enabled for high availability
   ```

2. **Configure Security Groups**:
   ```bash
   # Allow inbound on port 6379 from your Encore services
   # Source: Your VPC CIDR or specific security group
   ```

3. **Get Connection Details**:
   ```bash
   # Primary endpoint: your-cluster.xxxxx.cache.amazonaws.com:6379
   # Auth token: (if AUTH enabled)
   ```

### 2.3 Google Cloud Memorystore Redis

**Setup Steps**:

1. **Create Memorystore Instance**:
   ```bash
   # Google Cloud Console > Memorystore > Redis
   # Tier: Standard (HA enabled)
   # Capacity: 1GB+ (scale as needed)
   # Region: Same as your Encore deployment
   ```

2. **Configure VPC**:
   ```bash
   # Ensure your Encore services can access the Redis instance
   # Configure firewall rules if needed
   ```

## Option 3: Self-Managed Redis (Advanced)

### 3.1 Docker Redis with Persistence

```yaml
# docker-compose.redis.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    restart: unless-stopped

volumes:
  redis_data:
```

### 3.2 Redis Cluster (For High Availability)

```bash
# Create 3 Redis nodes for cluster
# Node 1: redis-node-1:7000
# Node 2: redis-node-2:7000  
# Node 3: redis-node-3:7000

# Initialize cluster
redis-cli --cluster create \
  redis-node-1:7000 \
  redis-node-2:7000 \
  redis-node-3:7000 \
  --cluster-replicas 1
```

## Implementation Guide

### Step 1: Choose Your Redis Option

**For Development**: Use current Encore built-in cache (already working)
**For Production**: Use Redis Cloud or AWS ElastiCache
**For Enterprise**: Use self-managed Redis cluster

### Step 2: Update Cache Implementation

If you choose external Redis, update the cache service:

```typescript
// backend/cache/redis_cache_service.ts
import Redis from 'ioredis';

class RedisCache<T> {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  async get(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, data: T, ttl?: string): Promise<void> {
    const ttlMs = this.parseTTL(ttl);
    await this.redis.setex(key, Math.floor(ttlMs / 1000), JSON.stringify(data));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

### Step 3: Environment Configuration

```bash
# .env file
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_SSL=true
```

### Step 4: Monitoring Setup

```typescript
// backend/cache/redis_monitoring.ts
export const getRedisMetrics = api<{}, {
  connected: boolean;
  memory: { used: string; peak: string };
  keys: { total: number; expired: number };
  operations: { total: number; perSecond: number };
}>(
  { auth: true, expose: true, method: "GET", path: "/cache/redis/metrics" },
  async () => {
    // Implement Redis INFO command parsing
    // Return Redis statistics
  }
);
```

## Performance Optimization for 1M Organizations

### 1. Connection Pooling
```typescript
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  // Connection pool settings
  family: 4,
  keepAlive: true,
  maxLoadingTimeout: 5000,
});
```

### 2. Key Naming Strategy
```typescript
// Hierarchical key structure for efficient operations
const keyPatterns = {
  reports: `reports:${orgId}:${propertyId}:${date}`,
  balance: `balance:${orgId}:${propertyId}:${date}`,
  summary: `summary:${orgId}:${propertyId}:${period}`
};
```

### 3. TTL Optimization
```typescript
// Intelligent TTL based on data recency
const getTTL = (date: string): number => {
  const today = new Date().toISOString().split('T')[0];
  const diffDays = Math.floor((new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 15; // 15 seconds for today
  if (diffDays <= 3) return 60; // 1 minute for last 3 days
  if (diffDays <= 7) return 180; // 3 minutes for last week
  return 600; // 10 minutes for historical
};
```

## Cost Estimation for 1M Organizations

### Redis Cloud Pricing (Approximate)
- **1GB Memory**: ~$25/month
- **4GB Memory**: ~$100/month  
- **16GB Memory**: ~$400/month

### AWS ElastiCache Pricing (Approximate)
- **cache.r6g.large**: ~$150/month
- **cache.r6g.xlarge**: ~$300/month
- **cache.r6g.2xlarge**: ~$600/month

### Google Memorystore Pricing (Approximate)
- **1GB Standard**: ~$50/month
- **4GB Standard**: ~$200/month
- **16GB Standard**: ~$800/month

## Recommendation

**For your current setup**: Stick with the Encore built-in cache implementation (Option 1) as it's already working and optimized for your use case.

**For production scaling**: Consider Redis Cloud or AWS ElastiCache when you need:
- Cross-region replication
- Advanced Redis features (streams, modules)
- Dedicated Redis infrastructure
- Advanced monitoring and alerting

The current implementation will handle 1M organizations efficiently with the intelligent TTL and distributed architecture we've built.
