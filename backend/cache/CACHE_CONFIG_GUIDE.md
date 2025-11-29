# Cache Configuration Guide

## Overview

The hospitality management platform uses a tiered cache architecture supporting:
- **L1**: Memory (process-local, fast)
- **L2**: Encore Cache (distributed, managed)
- **L3**: Redis (optional, for heavy workloads)

## Environment Variables

### Cache Backend Selection

```bash
# Options: memory | redis | encore | hybrid
CACHE_BACKEND=memory

# Options: L1 (memory only) | L1L2 (memory + Encore) | L1L2L3 (memory + Encore + Redis)
CACHE_TIERING=L1
```

### L1: Memory Cache Settings

```bash
CACHE_MEMORY_MAX_ENTRIES=10000
CACHE_MEMORY_DEFAULT_TTL=120000  # 2 minutes in milliseconds
```

### L2: Encore Cache Settings

```bash
CACHE_ENCORE_MAX_ENTRIES=1000000  # 1M entries for 1M orgs
CACHE_ENCORE_DEFAULT_TTL=5m
CACHE_ENCORE_EVICTION=AllKeysLRU  # Options: AllKeysLRU | AllKeysLFU | VolatileLRU
```

### L3: Redis Settings (Optional)

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_USE_TLS=false
REDIS_MAX_RETRIES=3
REDIS_CONNECT_TIMEOUT=5000
```

### Advanced Features

```bash
# Defensive invalidation: adds ±1 day to invalidation ranges
CACHE_DEFENSIVE_INVALIDATION=false

# Enable detailed cache metrics
CACHE_METRICS_ENABLED=true
```

## Configuration Examples

### Development (Local)

```bash
CACHE_TIERING=L1
```

### Staging Canary (10% traffic with Encore Cache)

```bash
CACHE_TIERING=L1L2
CACHE_ENCORE_MAX_ENTRIES=100000
```

### Production (Full scale with Redis support)

```bash
CACHE_TIERING=L1L2L3
CACHE_ENCORE_MAX_ENTRIES=1000000
REDIS_HOST=your-redis-cluster.cache.amazonaws.com
REDIS_PORT=6379
REDIS_USE_TLS=true
```

## Monitoring

### Health Check

```bash
curl http://localhost:4000/cache/health
```

Response includes tier-specific metrics:
- Hits/misses per tier
- Last hit tier
- Latency p50/p95
- Backend availability

### Cache Stats

```bash
curl http://localhost:4000/cache/stats
```

## Backout Strategy

To quickly disable tiered caching and fall back to memory-only:

```bash
CACHE_TIERING=L1
```

Then restart the application. No code changes or migrations required.

## Best Practices

1. **Start with L1** in development
2. **Test L1L2** in staging with canary rollout
3. **Monitor metrics** before full production rollout
4. **Add L3 Redis** only if needed for specific heavy workloads
5. **Use defensive invalidation** during migration periods

