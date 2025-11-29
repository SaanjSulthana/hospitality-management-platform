# Monitoring Dashboards Reference

## Overview

This document describes all available monitoring dashboards and endpoints for the hospitality management platform's observability infrastructure.

## Dashboard URLs

### Local Development
- **Base URL**: `http://localhost:4000`
- **All endpoints accessible without authentication for monitoring**

### Production
- **Base URL**: `https://api.production.app`
- **Some endpoints require authentication**

---

## 1. Unified Metrics Dashboard

**Primary monitoring endpoint for overall system health**

### Endpoint
```
GET /monitoring/unified/metrics
```

### Response Structure
```json
{
  "system": {
    "status": "healthy | degraded | unhealthy",
    "uptime": 12345,
    "timestamp": "2024-11-07T10:00:00Z"
  },
  "partitions": {
    "enabled": true,
    "synced": true,
    "switchoverReady": true,
    "tables": [
      {
        "name": "revenue_transactions",
        "rowCountDelta": 5,
        "status": "synced"
      }
    ]
  },
  "cache": {
    "type": "redis",
    "available": true,
    "hitRate": 85.5,
    "totalEntries": 125000,
    "invalidationsPerSecond": 2.3
  },
  "database": {
    "replicasEnabled": true,
    "replicaCount": 2,
    "maxReplicaLag": 3,
    "avgReplicaLag": 1.5,
    "connectionPoolUtilization": 65
  },
  "alerts": {
    "critical": 0,
    "warning": 1,
    "info": 2,
    "recentAlerts": [
      {
        "level": "warning",
        "source": "cache",
        "message": "Cache hit rate below 90%",
        "timestamp": "2024-11-07T09:55:00Z"
      }
    ]
  }
}
```

### Usage
```bash
# Check system status
curl http://localhost:4000/monitoring/unified/metrics | jq '.system.status'

# Check for critical alerts
curl http://localhost:4000/monitoring/unified/metrics | jq '.alerts.critical'

# Monitor continuously
watch -n 30 'curl -s http://localhost:4000/monitoring/unified/metrics | jq .'
```

---

## 2. System Health Check

**Quick health check for load balancers and uptime monitoring**

### Endpoint
```
GET /monitoring/unified/health
```

### Response Structure
```json
{
  "healthy": true,
  "status": "healthy",
  "checks": [
    {
      "name": "Partition Sync",
      "passed": true,
      "message": "All tables synced"
    },
    {
      "name": "Cache Availability",
      "passed": true,
      "message": "Cache is available"
    },
    {
      "name": "Replica Health",
      "passed": true,
      "message": "All replicas healthy"
    }
  ],
  "timestamp": "2024-11-07T10:00:00Z"
}
```

### Usage
```bash
# Simple health check
curl http://localhost:4000/monitoring/unified/health

# Use in health check scripts
if curl -sf http://localhost:4000/monitoring/unified/health | jq -e '.healthy == true' > /dev/null; then
  echo "System healthy"
else
  echo "System unhealthy"
  exit 1
fi
```

---

## 3. Partition Metrics Dashboard

**Detailed metrics for partitioned table sync and readiness**

### Endpoint
```
GET /monitoring/partitions/metrics
```

### Response Structure
```json
{
  "partitionedTablesEnabled": true,
  "tables": [
    {
      "name": "revenue_transactions",
      "rowCount": 1500000,
      "partitionedRowCount": 1500005,
      "rowCountDelta": -5,
      "lastSyncStatus": "synced",
      "partitionCount": 12
    },
    {
      "name": "expense_transactions",
      "rowCount": 800000,
      "partitionedRowCount": 800002,
      "rowCountDelta": -2,
      "lastSyncStatus": "synced",
      "partitionCount": 12
    }
  ],
  "switchoverReadiness": {
    "ready": true,
    "checks": [
      {
        "check": "Row count parity",
        "passed": true,
        "message": "All tables are synced (delta < 10 rows)"
      },
      {
        "check": "Partitions created",
        "passed": true,
        "message": "All partitioned tables have active partitions"
      },
      {
        "check": "Dual-write triggers",
        "passed": true,
        "message": "Dual-write triggers are active"
      },
      {
        "check": "Recent writes",
        "passed": true,
        "message": "Partitioned tables have recent writes (last 5 minutes)"
      }
    ]
  },
  "timestamp": "2024-11-07T10:00:00Z"
}
```

### Usage
```bash
# Check switchover readiness
curl http://localhost:4000/monitoring/partitions/metrics | jq '.switchoverReadiness.ready'

# Check specific table sync status
curl http://localhost:4000/monitoring/partitions/metrics | \
  jq '.tables[] | select(.name == "revenue_transactions") | {name, rowCountDelta, status}'

# Alert if any table out of sync
curl -s http://localhost:4000/monitoring/partitions/metrics | \
  jq -e '.tables[] | select(.lastSyncStatus != "synced") | .name' && \
  echo "ALERT: Tables out of sync!"
```

---

## 4. Cache Invalidation Metrics

**Cache performance and invalidation tracking**

### Endpoint
```
GET /monitoring/cache/invalidation-metrics
```

### Response Structure
```json
{
  "cacheType": "redis",
  "cacheAvailable": true,
  "invalidationStats": {
    "totalInvalidations": 15234,
    "invalidationsPerSecond": 2.5,
    "averageInvalidationTime": 12.5,
    "failedInvalidations": 3,
    "queuedInvalidations": 0
  },
  "cacheHitStats": {
    "totalRequests": 125000,
    "cacheHits": 106250,
    "cacheMisses": 18750,
    "hitRate": 85.0,
    "missRate": 15.0
  },
  "cacheSize": {
    "totalEntries": 125000,
    "memoryUsageMB": 125,
    "redisKeys": 125000
  },
  "performance": {
    "avgGetTime": 2.5,
    "avgSetTime": 3.2,
    "avgDeleteTime": 1.8
  },
  "alerts": [
    {
      "level": "warning",
      "message": "Cache hit rate below 90%"
    }
  ],
  "timestamp": "2024-11-07T10:00:00Z"
}
```

### Usage
```bash
# Check cache hit rate
curl http://localhost:4000/monitoring/cache/invalidation-metrics | jq '.cacheHitStats.hitRate'

# Check if Redis is available
curl http://localhost:4000/monitoring/cache/invalidation-metrics | jq '.cacheAvailable'

# Monitor cache performance
watch -n 10 'curl -s http://localhost:4000/monitoring/cache/invalidation-metrics | \
  jq "{hitRate: .cacheHitStats.hitRate, avgGetTime: .performance.avgGetTime}"'
```

---

## 5. Database Replica Metrics

**Replica health, lag, and connection pool stats**

### Replica Health
```
GET /database/replica/health
```

Response:
```json
{
  "healthy": true,
  "replicas": [
    {
      "name": "read_replica",
      "healthy": true
    }
  ],
  "timestamp": "2024-11-07T10:00:00Z"
}
```

### Replica Lag
```
GET /database/replica/lag
```

Response:
```json
{
  "replicas": [
    {
      "name": "read_replica",
      "lagSeconds": 2,
      "status": "healthy"
    }
  ],
  "maxLag": 2,
  "avgLag": 2,
  "timestamp": "2024-11-07T10:00:00Z"
}
```

### Connection Pool Stats
```
GET /database/replica/pool-stats
```

Response:
```json
{
  "primary": {
    "total_connections": 45,
    "active_connections": 12,
    "idle_connections": 33
  },
  "replicas": {
    "read_replica": {
      "total_connections": 30,
      "active_connections": 8,
      "idle_connections": 22
    }
  },
  "timestamp": "2024-11-07T10:00:00Z"
}
```

### Usage
```bash
# Check replica lag
curl http://localhost:4000/database/replica/lag | jq '.maxLag'

# Alert if lag > 30 seconds
LAG=$(curl -s http://localhost:4000/database/replica/lag | jq -r '.maxLag')
if (( $(echo "$LAG > 30" | bc -l) )); then
  echo "ALERT: Replica lag is ${LAG}s"
fi

# Check connection pool utilization
curl http://localhost:4000/database/replica/pool-stats | \
  jq '{primary: .primary, replica: .replicas.read_replica}'
```

---

## 6. Cache Service Stats

**Cache service endpoints and statistics**

### Endpoint
```
GET /cache/stats
```

### Response Structure
```json
{
  "totalEntries": 125000,
  "hitRate": 85.0,
  "missRate": 15.0,
  "invalidations": 15234,
  "memoryUsage": 125000000,
  "averageResponseTime": 2.5,
  "redisStats": {
    "type": "redis",
    "available": true,
    "memoryEntries": 125000,
    "redisInfo": {
      "connected": true,
      "keys": 125000,
      "info": "..."
    }
  }
}
```

### Cache Health
```
GET /cache/health
```

Response:
```json
{
  "service": "CacheService",
  "version": "1.0.0",
  "status": "healthy",
  "dependencies": [
    {
      "name": "ReportsCache",
      "status": "healthy"
    }
  ],
  "timestamp": "2024-11-07T10:00:00Z"
}
```

---

## 7. Alert Management

### Get Alert History
```
GET /monitoring/unified/alerts?limit=50
```

Response:
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "level": "warning",
      "source": "cache",
      "message": "Cache hit rate below 90%",
      "value": 85.5,
      "threshold": 90,
      "timestamp": "2024-11-07T09:55:00Z",
      "acknowledged": false
    }
  ],
  "total": 25
}
```

### Acknowledge Alert
```
POST /monitoring/unified/acknowledge-alert
Content-Type: application/json

{
  "alertId": "alert-123"
}
```

---

## Monitoring Scripts

### Comprehensive Health Check Script

```bash
#!/bin/bash
# health_check.sh - Comprehensive system health check

BASE_URL="${MONITORING_URL:-http://localhost:4000}"

echo "=== System Health Check ==="
echo ""

# 1. Overall health
echo "1. Overall System Health:"
curl -s $BASE_URL/monitoring/unified/health | jq -r '.status'
echo ""

# 2. Partition status
echo "2. Partition Status:"
curl -s $BASE_URL/monitoring/partitions/metrics | \
  jq -r '.tables[] | "\(.name): \(.lastSyncStatus) (delta: \(.rowCountDelta))"'
echo ""

# 3. Cache performance
echo "3. Cache Performance:"
curl -s $BASE_URL/monitoring/cache/invalidation-metrics | \
  jq -r '"Hit Rate: \(.cacheHitStats.hitRate)% | Type: \(.cacheType) | Available: \(.cacheAvailable)"'
echo ""

# 4. Replica status
echo "4. Replica Status:"
curl -s $BASE_URL/database/replica/lag | \
  jq -r '"Max Lag: \(.maxLag)s | Avg Lag: \(.avgLag)s"'
echo ""

# 5. Active alerts
echo "5. Active Alerts:"
CRITICAL=$(curl -s $BASE_URL/monitoring/unified/metrics | jq -r '.alerts.critical')
WARNING=$(curl -s $BASE_URL/monitoring/unified/metrics | jq -r '.alerts.warning')
echo "Critical: $CRITICAL | Warning: $WARNING"
echo ""

# Overall status
if [ "$CRITICAL" -gt 0 ]; then
  echo "❌ UNHEALTHY: Critical alerts detected"
  exit 2
elif [ "$WARNING" -gt 0 ]; then
  echo "⚠️  DEGRADED: Warnings detected"
  exit 1
else
  echo "✅ HEALTHY: All systems operational"
  exit 0
fi
```

### Continuous Monitoring Script

```bash
#!/bin/bash
# monitor_continuous.sh - Continuous monitoring with alerts

BASE_URL="${MONITORING_URL:-http://localhost:4000}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-https://hooks.slack.com/services/YOUR/WEBHOOK}"
CHECK_INTERVAL=60

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # Get unified metrics
  metrics=$(curl -s $BASE_URL/monitoring/unified/metrics)
  
  status=$(echo $metrics | jq -r '.system.status')
  critical=$(echo $metrics | jq -r '.alerts.critical')
  warning=$(echo $metrics | jq -r '.alerts.warning')
  
  # Log status
  echo "[$timestamp] Status: $status | Critical: $critical | Warning: $warning"
  
  # Alert if unhealthy
  if [ "$status" != "healthy" ] || [ "$critical" -gt 0 ]; then
    message="🚨 ALERT: System status: $status | Critical alerts: $critical"
    
    # Send to Slack
    curl -X POST $SLACK_WEBHOOK \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"$message\", \"username\": \"Monitoring Bot\"}"
    
    echo "  → Alert sent to Slack"
  fi
  
  sleep $CHECK_INTERVAL
done
```

---

## Grafana Dashboard Integration

### Prometheus Metrics Exporter

```typescript
// Example Prometheus metrics endpoint
export const prometheusMetrics = api(
  { auth: false, expose: true, method: "GET", path: "/metrics" },
  async () => {
    const metrics = await getUnifiedMetrics({});
    
    const output = `
# HELP system_status System health status (0=healthy, 1=degraded, 2=unhealthy)
# TYPE system_status gauge
system_status ${metrics.system.status === 'healthy' ? 0 : metrics.system.status === 'degraded' ? 1 : 2}

# HELP cache_hit_rate Cache hit rate percentage
# TYPE cache_hit_rate gauge
cache_hit_rate ${metrics.cache.hitRate}

# HELP replica_lag_seconds Maximum replica lag in seconds
# TYPE replica_lag_seconds gauge
replica_lag_seconds ${metrics.database.maxReplicaLag}

# HELP partition_row_delta Partition row count delta
# TYPE partition_row_delta gauge
${metrics.partitions.tables.map(t => 
  `partition_row_delta{table="${t.name}"} ${Math.abs(t.rowCountDelta)}`
).join('\n')}

# HELP alerts_total Total number of alerts by level
# TYPE alerts_total counter
alerts_total{level="critical"} ${metrics.alerts.critical}
alerts_total{level="warning"} ${metrics.alerts.warning}
alerts_total{level="info"} ${metrics.alerts.info}
    `.trim();
    
    return output;
  }
);
```

### Grafana Dashboard JSON

Available in `backend/monitoring/grafana_dashboard.json` (to be created separately)

---

## Alert Rules

### Recommended Alerting Rules

```yaml
# alerting_rules.yml

groups:
  - name: hospitality_platform
    interval: 30s
    rules:
      - alert: SystemUnhealthy
        expr: system_status == 2
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "System is unhealthy"
          
      - alert: HighReplicaLag
        expr: replica_lag_seconds > 30
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Replica lag is {{ $value }}s"
          
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Cache hit rate is {{ $value }}%"
          
      - alert: PartitionOutOfSync
        expr: partition_row_delta > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Partition {{ $labels.table }} delta is {{ $value }}"
```

---

## Summary of All Endpoints

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `/monitoring/unified/metrics` | Overall system metrics | No |
| `/monitoring/unified/health` | Quick health check | No |
| `/monitoring/unified/alerts` | Alert history | Yes |
| `/monitoring/partitions/metrics` | Partition sync status | No |
| `/monitoring/cache/invalidation-metrics` | Cache performance | No |
| `/database/replica/health` | Replica health check | No |
| `/database/replica/lag` | Replication lag | No |
| `/database/replica/pool-stats` | Connection pools | No |
| `/cache/stats` | Cache statistics | Yes |
| `/cache/health` | Cache health | No |

---

## Next Steps

1. **Set up monitoring scripts** in production environment
2. **Configure Prometheus** to scrape metrics endpoints
3. **Create Grafana dashboards** using provided JSON
4. **Set up alerting** using provided alert rules
5. **Test alert delivery** to Slack/PagerDuty
6. **Document on-call procedures** for responding to alerts
7. **Schedule regular review** of monitoring effectiveness

## Related Documents

- [Rollout & Rollback Handbook](../infrastructure/ROLLOUT_ROLLBACK_HANDBOOK.md)
- [Monitoring Endpoints Reference](MONITORING_ENDPOINTS_REFERENCE.md)
- [Alert Response Playbook](ALERT_RESPONSE_PLAYBOOK.md) (to be created)

