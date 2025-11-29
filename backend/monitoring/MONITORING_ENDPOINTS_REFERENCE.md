# Monitoring Endpoints Reference

## Overview

This document provides a complete reference of all monitoring, metrics, and observability endpoints available in the hospitality management platform.

**Base URL**: `https://your-app.encr.app`

---

## 🎯 Quick Health Checks

### 1. Simple Health Check (Load Balancer)
```bash
GET /health

# Response:
{
  "status": "ok" | "degraded" | "error",
  "timestamp": "2025-11-07T10:30:00.000Z"
}

# Use for: Load balancer health checks
# Response time: < 100ms
```

### 2. Liveness Check (Kubernetes)
```bash
GET /live

# Response:
{
  "alive": true,
  "timestamp": "2025-11-07T10:30:00.000Z"
}

# Use for: Kubernetes liveness probe
# Response time: < 50ms
```

### 3. Readiness Check (Kubernetes)
```bash
GET /ready

# Response:
{
  "ready": true,
  "timestamp": "2025-11-07T10:30:00.000Z",
  "checks": {
    "cache": true,
    "database": true,
    "metrics": true
  }
}

# Use for: Kubernetes readiness probe
# Response time: < 200ms
```

---

## 📊 System Monitoring

### 1. System Health Dashboard (Main)
```bash
GET /monitoring/dashboard

# Response: Comprehensive system health
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "overallStatus": "healthy" | "degraded" | "critical",
  "components": {
    "cache": { "status": "healthy", "backend": "redis", ... },
    "database": { "status": "healthy", "replicas": {...}, ... },
    "partitions": { "status": "healthy", "enabled": true, ... },
    "invalidation": { "status": "healthy", "queueSize": 0, ... }
  },
  "alerts": {
    "active": 0,
    "critical": 0,
    "warning": 0
  },
  "metrics": { ... }
}

# Use for: Operations dashboard, primary monitoring
# Update frequency: Every 60 seconds
# Response time: < 500ms
```

### 2. Performance Metrics (Legacy)
```bash
GET /monitoring/performance

# Response:
{
  "cacheHitRate": 0.85,
  "avgQueryTime": 45,
  "pubsubLatency": 12,
  "correctionQueueSize": 5,
  "circuitBreakerStatus": {
    "database": "CLOSED",
    "cache": "CLOSED",
    "pubsub": "CLOSED"
  },
  "cacheInvalidationStats": { ... },
  "memoryUsage": 512000000,
  "activeConnections": 45
}

# Use for: Detailed performance analysis
```

### 3. System Metrics (Legacy)
```bash
GET /monitoring/system

# Response:
{
  "cache": { ... },
  "invalidation": { ... },
  "correction": { ... },
  "circuitBreakers": { ... }
}

# Use for: Debugging, detailed investigation
```

---

## 💾 Cache Monitoring

### 1. Cache Status
```bash
GET /cache/status

# Response:
{
  "status": "healthy" | "degraded" | "error",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "caches": {
    "reports": {
      "type": "redis" | "memory",
      "available": true,
      "memoryEntries": 1250,
      "redisInfo": {
        "connected": true,
        "keys": 50000,
        "info": "..."
      }
    },
    "balance": { ... },
    "summary": { ... }
  }
}

# Use for: Cache health monitoring, Redis connectivity
# Alert if: type != "redis" (when Redis configured)
```

### 2. Cache Health Check
```bash
GET /cache/health

# Response:
{
  "healthy": true,
  "timestamp": "2025-11-07T10:30:00.000Z",
  "backend": "redis" | "memory",
  "message": "Cache is healthy using redis backend"
}

# Use for: Simple cache health check
```

---

## 🗄️ Database Monitoring

### 1. Replica Status
```bash
GET /database/replicas/status

# Response:
{
  "status": "healthy" | "degraded" | "error",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "primary": {
    "healthy": true,
    "connections": {
      "total_connections": 45,
      "active_connections": 12,
      "idle_connections": 33
    }
  },
  "replicas": {
    "count": 1,
    "healthy": 1,
    "unhealthy": 0,
    "lag": {
      "read_replica": 2
    },
    "health": {
      "read_replica": true
    },
    "connections": { ... }
  }
}

# Use for: Replica health, lag monitoring
# Alert if: unhealthy > 0 OR lag > 60 seconds
```

### 2. Replica Health Check
```bash
GET /database/replicas/health

# Response:
{
  "healthy": true,
  "timestamp": "2025-11-07T10:30:00.000Z",
  "replicasEnabled": true,
  "replicaCount": 1,
  "message": "All 1 replicas are healthy"
}

# Use for: Simple replica health check
```

### 3. Replica Lag
```bash
GET /database/replicas/lag

# Response:
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "replicas": [
    {
      "name": "read_replica",
      "lagSeconds": 2,
      "status": "healthy" | "warning" | "critical" | "error"
    }
  ]
}

# Use for: Replication lag monitoring
# Thresholds:
#   - healthy: < 10 seconds
#   - warning: 10-60 seconds
#   - critical: > 60 seconds
```

### 4. Connection Pool Stats
```bash
GET /database/connection-pool/stats

# Response:
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "primary": {
    "total_connections": 45,
    "active_connections": 12,
    "idle_connections": 33
  },
  "replicas": {
    "read_replica": {
      "total_connections": 25,
      "active_connections": 8,
      "idle_connections": 17
    }
  }
}

# Use for: Connection pool monitoring
# Alert if: active_connections > 80 (80% of max)
```

---

## 📈 Metrics & Time Series

### 1. All Metrics
```bash
GET /metrics/all

# Response:
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "metrics": {
    "cache.redis.connected": { "value": 1, "timestamp": 1699354200000 },
    "cache.reports.entries": { "value": 1250, "timestamp": 1699354200000 },
    "replica.lag.max": { "value": 2, "timestamp": 1699354200000 },
    "db.primary.connections.active": { "value": 12, "timestamp": 1699354200000 },
    ... (all metrics)
  }
}

# Use for: Exporting to external monitoring (Prometheus, Grafana)
```

### 2. Single Metric History
```bash
GET /metrics/:name

# Example: GET /metrics/replica.lag.max

# Response:
{
  "name": "replica.lag.max",
  "timestamp": "2025-11-07T10:30:00.000Z",
  "data": {
    "current": 2,
    "min": 0,
    "max": 5,
    "avg": 2.3,
    "count": 60  # 60 data points in last hour
  }
}

# Use for: Time-series analysis, debugging
```

### 3. Aggregated Metrics
```bash
GET /metrics/aggregated

# Response:
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "cache": {
    "available": true,
    "backend": "redis",
    "totalEntries": 3500,
    "invalidationQueue": 5
  },
  "database": {
    "replicasEnabled": true,
    "replicaCount": 1,
    "healthyReplicas": 1,
    "maxReplicaLag": 2,
    "primaryConnections": {
      "total": 45,
      "active": 12,
      "idle": 33
    }
  },
  "partitions": {
    "enabled": true,
    "count": 24
  }
}

# Use for: High-level system overview
```

---

## 🚨 Alerts & Notifications

### 1. Active Alerts
```bash
GET /alerts/active

# Response:
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "stats": {
    "active": 2,
    "critical": 0,
    "warning": 2,
    "info": 0,
    "acknowledged": 0
  },
  "alerts": [
    {
      "id": "cache.invalidation.queue.size:1000",
      "name": "High Cache Invalidation Queue",
      "severity": "warning",
      "message": "Cache invalidation queue size exceeds 1000 entries",
      "metric": "cache.invalidation.queue.size",
      "threshold": 1000,
      "currentValue": 1250,
      "timestamp": "2025-11-07T10:25:00.000Z",
      "acknowledged": false
    }
  ]
}

# Use for: Alert dashboard, incident response
```

### 2. Alert History
```bash
GET /alerts/history?limit=100

# Response:
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "count": 45,
  "alerts": [ ... ]  # Last 100 alerts
}

# Use for: Post-incident analysis, trends
```

### 3. Alert Stats
```bash
GET /alerts/stats

# Response:
{
  "timestamp": "2025-11-07T10:30:00.000Z",
  "stats": {
    "active": 2,
    "critical": 0,
    "warning": 2,
    "info": 0,
    "acknowledged": 0
  }
}

# Use for: High-level alert overview
```

### 4. Acknowledge Alert
```bash
POST /alerts/:alertId/acknowledge

# Example: POST /alerts/cache.invalidation.queue.size:1000/acknowledge

# Response:
{
  "success": true,
  "message": "Alert cache.invalidation.queue.size:1000 acknowledged successfully"
}

# Use for: Alert management, incident tracking
```

### 5. Clear Alert
```bash
POST /alerts/:alertId/clear

# Example: POST /alerts/cache.invalidation.queue.size:1000/clear

# Response:
{
  "success": true,
  "message": "Alert cache.invalidation.queue.size:1000 cleared successfully"
}

# Use for: Manual alert resolution
```

---

## 📋 Metrics Dictionary

### Cache Metrics
| Metric Name | Type | Description | Healthy Range |
|-------------|------|-------------|---------------|
| `cache.redis.connected` | Binary | Redis connection status | 1 (connected) |
| `cache.reports.entries` | Gauge | Entries in reports cache | 0-10000 |
| `cache.balance.entries` | Gauge | Entries in balance cache | 0-10000 |
| `cache.summary.entries` | Gauge | Entries in summary cache | 0-10000 |
| `cache.redis.keys` | Gauge | Total Redis keys | 0-1000000 |
| `cache.invalidation.queue.size` | Gauge | Invalidation queue size | < 1000 |
| `cache.invalidation.total` | Counter | Total invalidations | N/A |
| `cache.invalidation.failed` | Counter | Failed invalidations | 0 |

### Replica Metrics
| Metric Name | Type | Description | Healthy Range |
|-------------|------|-------------|---------------|
| `replica.enabled` | Binary | Replicas enabled | 1 (true) |
| `replica.total.count` | Gauge | Total replicas | 1+ |
| `replica.healthy.count` | Gauge | Healthy replicas | = total.count |
| `replica.unhealthy.count` | Gauge | Unhealthy replicas | 0 |
| `replica.lag.max` | Gauge | Max replica lag (seconds) | < 10 |
| `replica.lag.{name}` | Gauge | Per-replica lag (seconds) | < 10 |

### Database Metrics
| Metric Name | Type | Description | Healthy Range |
|-------------|------|-------------|---------------|
| `db.primary.connections.total` | Gauge | Total connections | 0-100 |
| `db.primary.connections.active` | Gauge | Active connections | < 80 |
| `db.primary.connections.idle` | Gauge | Idle connections | > 10 |

### Partition Metrics
| Metric Name | Type | Description | Healthy Range |
|-------------|------|-------------|---------------|
| `partition.enabled` | Binary | Partitions enabled | 1 (true) |
| `partition.count` | Gauge | Number of partitions | 24 (2 years) |
| `partition.maintenance.running` | Binary | Maintenance active | 0-1 |

---

## 🎨 Dashboard Templates

### Grafana Dashboard Query Examples

#### Cache Hit Rate Panel
```promql
# If exporting to Prometheus
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

#### Replica Lag Panel
```json
{
  "datasource": "Your-App-API",
  "targets": [
    {
      "url": "/metrics/replica.lag.max",
      "refId": "A"
    }
  ]
}
```

#### Active Connections Panel
```json
{
  "datasource": "Your-App-API",
  "targets": [
    {
      "url": "/metrics/db.primary.connections.active",
      "refId": "A"
    }
  ]
}
```

---

## 🔧 cURL Examples

### Monitoring Script
```bash
#!/bin/bash
# monitoring_check.sh

BASE_URL="https://your-app.encr.app"

echo "=== System Health ==="
curl -s "$BASE_URL/health" | jq '.'

echo -e "\n=== Cache Status ==="
curl -s "$BASE_URL/cache/status" | jq '.status, .caches.reports.type'

echo -e "\n=== Replica Status ==="
curl -s "$BASE_URL/database/replicas/status" | jq '.status, .replicas'

echo -e "\n=== Active Alerts ==="
curl -s "$BASE_URL/alerts/active" | jq '.stats'

echo -e "\n=== Aggregated Metrics ==="
curl -s "$BASE_URL/metrics/aggregated" | jq '.'
```

### Alert Check Script
```bash
#!/bin/bash
# alert_check.sh

ALERTS=$(curl -s "https://your-app.encr.app/alerts/active" | jq -r '.stats.critical')

if [ "$ALERTS" -gt 0 ]; then
  echo "CRITICAL: $ALERTS critical alerts active!"
  curl -s "https://your-app.encr.app/alerts/active" | jq '.alerts[] | select(.severity=="critical")'
  exit 2
fi

echo "OK: No critical alerts"
exit 0
```

---

## 📞 Integration Examples

### Prometheus Exporter (Conceptual)
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'hospitality-platform'
    metrics_path: '/metrics/all'
    static_configs:
      - targets: ['your-app.encr.app']
```

### Datadog Integration
```python
# datadog_integration.py
import requests
from datadog import statsd

response = requests.get('https://your-app.encr.app/metrics/aggregated')
metrics = response.json()

statsd.gauge('hospitality.cache.entries', metrics['cache']['totalEntries'])
statsd.gauge('hospitality.replica.lag', metrics['database']['maxReplicaLag'])
```

### New Relic Integration
```javascript
// newrelic_integration.js
const axios = require('axios');
const newrelic = require('newrelic');

async function collectMetrics() {
  const { data } = await axios.get('https://your-app.encr.app/metrics/aggregated');
  
  newrelic.recordMetric('Custom/Cache/Entries', data.cache.totalEntries);
  newrelic.recordMetric('Custom/Replica/Lag', data.database.maxReplicaLag);
}
```

---

## 🔒 Authentication

All monitoring endpoints are currently **public** (no authentication required).

For production deployments, consider adding authentication:

```typescript
// Example: Add auth to monitoring endpoints
export const getSystemHealthDashboard = api(
  { 
    expose: true,
    method: "GET",
    path: "/monitoring/dashboard",
    auth: true  // Require authentication
  },
  async (): Promise<SystemHealthDashboard> => {
    // ...
  }
);
```

---

## 📊 Response Time SLAs

| Endpoint Category | Target Response Time | Max Acceptable |
|-------------------|---------------------|----------------|
| Health Checks | < 100ms | 200ms |
| Cache Status | < 200ms | 500ms |
| Replica Status | < 300ms | 1000ms |
| Metrics | < 500ms | 1500ms |
| Dashboard | < 500ms | 2000ms |
| Alerts | < 300ms | 1000ms |

---

## 🆘 Support

For issues with monitoring endpoints:
1. Check endpoint is accessible: `curl https://your-app.encr.app/health`
2. Verify Encore services are running: `encore ps`
3. Review application logs: `encore logs`
4. Contact DevOps team: devops@example.com

---

**Last Updated**: 2025-11-07  
**Version**: 1.0.0  
**Maintained By**: DevOps Team

