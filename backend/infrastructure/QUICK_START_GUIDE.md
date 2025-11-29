# Quick Start Guide - Infrastructure & Observability

> **Quick reference for developers and operators**

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd backend
bun install  # Installs ioredis and other dependencies
```

### 2. Start Local Development

```bash
# Start the application
encore run

# In another terminal, verify monitoring
curl http://localhost:4000/monitoring/unified/health
```

### 3. Run Tests

```bash
cd backend/tests
bash run_all_checks.sh development
```

---

## 📊 Key Monitoring Endpoints

### System Status (Quick Check)
```bash
curl http://localhost:4000/monitoring/unified/health | jq .
```

### Comprehensive Metrics
```bash
curl http://localhost:4000/monitoring/unified/metrics | jq .
```

### Partition Sync Status
```bash
curl http://localhost:4000/monitoring/partitions/metrics | jq '.switchoverReadiness'
```

### Cache Performance
```bash
curl http://localhost:4000/monitoring/cache/invalidation-metrics | jq '.cacheHitStats.hitRate'
```

### Database Replication
```bash
curl http://localhost:4000/database/replica/lag | jq '.maxLag'
```

---

## 🔧 Infrastructure Setup

### Redis (Optional but Recommended)

```bash
# Using Docker
cd backend/infrastructure
docker-compose -f docker-compose.redis.yml up -d

# Set environment variables
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=redis-password
```

📖 **Full Guide**: `backend/infrastructure/redis_provisioning.md`

### PgBouncer (Optional but Recommended)

```bash
# Using Docker (see pgbouncer_setup.md for details)
docker run -d \
  --name pgbouncer \
  -p 6432:6432 \
  -v $(pwd)/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
  edoburu/pgbouncer:latest

# Update connection
export DB_PORT=6432  # Use PgBouncer port
```

📖 **Full Guide**: `backend/infrastructure/pgbouncer_setup.md`

### Read Replicas (Optional)

```bash
# Enable read replicas
export USE_READ_REPLICAS=true
export READ_REPLICA_CONNECTION_STRING=postgresql://...

# Verify
curl http://localhost:4000/database/info | jq '.replicasEnabled'
```

📖 **Full Guide**: `backend/infrastructure/replica_initialization.md`

---

## 🧪 Testing

### Run All Tests
```bash
bash backend/tests/run_all_checks.sh development
```

### Smoke Tests Only
```bash
bash backend/tests/smoke_tests.sh development
```

### Observability Checks
```bash
bash backend/tests/observability_checks.sh
```

📖 **Full Guide**: `backend/tests/TEST_EXECUTION_GUIDE.md`

---

## 🚢 Deployment

### Enable Partitioned Tables

```bash
# Set environment variable
export USE_PARTITIONED_TABLES=true

# Restart application
encore run
```

### Follow Rollout Handbook

📖 **Required Reading**: `backend/infrastructure/ROLLOUT_ROLLBACK_HANDBOOK.md`

**Phases**:
1. Development → 2. Staging → 3. Production Pilot (1%) → 4. Gradual Rollout

---

## ⚠️ Troubleshooting

### System Unhealthy

```bash
# Check what's failing
curl http://localhost:4000/monitoring/unified/health | jq '.checks'

# Check for critical alerts
curl http://localhost:4000/monitoring/unified/metrics | jq '.alerts'
```

### Partition Out of Sync

```bash
# Check row count delta
curl http://localhost:4000/monitoring/partitions/metrics | jq '.tables'

# If delta > 100, investigate dual-write triggers
```

### Low Cache Hit Rate

```bash
# Check cache stats
curl http://localhost:4000/monitoring/cache/invalidation-metrics

# Verify Redis is available
curl http://localhost:4000/cache/health
```

### High Replica Lag

```bash
# Check replica status
curl http://localhost:4000/database/replica/lag

# Check replica health
curl http://localhost:4000/database/replica/health
```

---

## 📖 Complete Documentation

| Topic | Document |
|-------|----------|
| Redis Setup | `backend/infrastructure/redis_provisioning.md` |
| PgBouncer Setup | `backend/infrastructure/pgbouncer_setup.md` |
| Replica Setup | `backend/infrastructure/replica_initialization.md` |
| Deployment | `backend/infrastructure/ROLLOUT_ROLLBACK_HANDBOOK.md` |
| Monitoring | `backend/monitoring/MONITORING_DASHBOARDS.md` |
| Testing | `backend/tests/TEST_EXECUTION_GUIDE.md` |
| Task Summary | `.agent-os/specs/2025-10-29-partitioned-db-activation/TASK_3_COMPLETION_SUMMARY.md` |

---

## 🔑 Environment Variables Reference

### Core Settings
```bash
# Partitioned tables
USE_PARTITIONED_TABLES=true

# Database
DB_HOST=localhost
DB_PORT=6432  # PgBouncer port (or 5432 for direct)
DB_NAME=hospitality_platform
DB_USER=postgres
DB_PASSWORD=postgres
```

### Redis Settings
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis-password
REDIS_USE_TLS=false
```

### Replica Settings
```bash
USE_READ_REPLICAS=true
READ_REPLICA_CONNECTION_STRING=postgresql://...
REPLICA_HEALTH_CHECK_INTERVAL=30000
```

---

## 📞 Support

- **Documentation**: See links above
- **Slack**: #platform-engineering
- **Email**: platform-team@example.com
- **On-call**: PagerDuty - Platform Engineering

---

## ✅ Quick Health Check Script

Save this as `health_check.sh`:

```bash
#!/bin/bash
echo "🔍 Quick Health Check"
echo ""

echo "System Status:"
curl -s http://localhost:4000/monitoring/unified/health | jq -r '.status'

echo ""
echo "Critical Alerts:"
curl -s http://localhost:4000/monitoring/unified/metrics | jq -r '.alerts.critical'

echo ""
echo "Cache Hit Rate:"
curl -s http://localhost:4000/monitoring/cache/invalidation-metrics | jq -r '.cacheHitStats.hitRate'

echo ""
echo "Partition Sync:"
curl -s http://localhost:4000/monitoring/partitions/metrics | jq -r '.switchoverReadiness.ready'
```

Run: `bash health_check.sh`

---

**Last Updated**: 2024-11-07  
**Version**: 1.0

