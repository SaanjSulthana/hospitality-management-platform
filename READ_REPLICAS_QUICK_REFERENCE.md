# 🚀 Read Replicas Quick Reference Card

**Last Updated:** 2025-12-13  
**Status:** Infrastructure Ready, Awaiting Production Provisioning

---

## 📊 Quick Status Check

```bash
# Check replica health
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/v1/system/database/replicas/health

# Check replication lag
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/v1/system/database/replicas/lag

# Check connection pool stats
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/v1/system/database/connection-pool/stats
```

---

## 🎯 Target Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Replication Lag | < 1s | > 5s | > 10s |
| Replica Health | All healthy | 1 unhealthy | 2+ unhealthy |
| Connection Pool | < 70% | > 80% | > 90% |
| Read Distribution | 80% on replicas | < 60% | < 40% |

---

## 🔧 Common Operations

### Provision New Replica (AWS RDS)
```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier hospitality-replica-N \
  --source-db-instance-identifier hospitality-primary \
  --db-instance-class db.r5.xlarge \
  --availability-zone us-east-1a
```

### Check Replication Status (SQL)
```sql
-- On primary
SELECT * FROM pg_stat_replication;

-- On replica
SELECT 
  now() - pg_last_xact_replay_timestamp() AS lag,
  pg_is_in_recovery() AS is_replica;
```

### Restart Replica (if stuck)
```bash
# AWS RDS
aws rds reboot-db-instance --db-instance-identifier hospitality-replica-1

# Self-hosted
sudo systemctl restart postgresql
```

---

## 🚨 Troubleshooting

### High Lag (> 10s)
1. Check network latency: `ping replica-host`
2. Check replica CPU/memory: Monitor instance metrics
3. Check for long queries: `SELECT * FROM pg_stat_activity WHERE state = 'active'`
4. Consider upgrading replica instance size

### Replica Unhealthy
1. Check connectivity: `psql -h replica-host -c "SELECT 1"`
2. Check logs: `tail -f /var/log/postgresql/postgresql.log`
3. Verify replication slot: `SELECT * FROM pg_replication_slots`
4. Restart replica if needed

### Connection Pool Exhausted
1. Check active connections: Use connection pool stats endpoint
2. Identify slow queries: `SELECT * FROM pg_stat_activity ORDER BY query_start`
3. Kill long-running queries if needed: `SELECT pg_terminate_backend(pid)`
4. Consider increasing pool size

---

## 📋 Environment Variables

```bash
USE_READ_REPLICAS=true
READ_REPLICA_1_CONNECTION_STRING=postgresql://...
READ_REPLICA_2_CONNECTION_STRING=postgresql://...
READ_REPLICA_3_CONNECTION_STRING=postgresql://...
REPLICA_HEALTH_CHECK_INTERVAL=30000
DB_MAX_CONNECTIONS=100
```

---

## 📞 Escalation

- **High Lag (> 10s for > 5 min):** Page on-call DBA
- **Replica Unhealthy (> 5 min):** Page on-call engineer
- **Connection Pool > 90%:** Immediate investigation required
- **All Replicas Down:** Critical incident, page team lead

---

## 📚 Full Documentation

- [READ_REPLICAS_PROVISIONING_GUIDE.md](READ_REPLICAS_PROVISIONING_GUIDE.md) - Complete guide
- [TASK_2.2_COMPLETION_SUMMARY.md](TASK_2.2_COMPLETION_SUMMARY.md) - Implementation summary
- [`backend/database/replica_manager.ts`](backend/database/replica_manager.ts) - Code reference

---

**For detailed instructions, see:** [READ_REPLICAS_PROVISIONING_GUIDE.md](READ_REPLICAS_PROVISIONING_GUIDE.md)
