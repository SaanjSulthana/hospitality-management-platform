# Replica Manager Initialization Guide

## Overview

The Replica Manager provides intelligent read/write splitting and connection management for PostgreSQL primary and replica databases, enabling horizontal scaling for read-heavy workloads.

## Architecture

```
┌─────────────────┐
│  Application    │
│   Services      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Replica Manager │ (Load Balancer)
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌────────┐
    │Primary │    │Replica1│    │Replica2│
    │(Write) │    │ (Read) │    │ (Read) │
    └────────┘    └────────┘    └────────┘
```

## Features

- **Automatic Read/Write Splitting**: Routes SELECT queries to replicas, write queries to primary
- **Load Balancing**: Round-robin distribution across read replicas
- **Health Monitoring**: Automatic health checks every 30 seconds
- **Failover**: Falls back to primary if replicas are unavailable
- **Connection Pooling**: Optimized connection pools for primary and replicas
- **Lag Monitoring**: Tracks replication lag across all replicas
- **PgBouncer Integration**: Works seamlessly with PgBouncer connection pooler

## Environment Variables

Add these to your environment configuration:

```bash
# Enable read replicas
USE_READ_REPLICAS=true

# Primary database (write operations)
DB_HOST=localhost
DB_PORT=6432  # Use PgBouncer port
DB_NAME=hospitality_platform
DB_USER=postgres
DB_PASSWORD=postgres

# Connection pool settings for primary
DB_MAX_CONNECTIONS=100
DB_MIN_CONNECTIONS=10
DB_MAX_IDLE_TIME=10m
DB_MAX_LIFETIME=1h
DB_CONNECTION_TIMEOUT=30s
DB_QUERY_TIMEOUT=60s

# Read replica connection (if separate from primary)
READ_REPLICA_CONNECTION_STRING=postgresql://postgres:postgres@localhost:6433/hospitality_platform

# Replica health check interval (milliseconds)
REPLICA_HEALTH_CHECK_INTERVAL=30000

# Replica timeout settings
REPLICA_QUERY_TIMEOUT=60s
REPLICA_CONNECTION_TIMEOUT=30s
```

## PostgreSQL Replication Setup

### 1. Configure Primary Database

Edit `postgresql.conf` on primary:

```conf
# Replication settings
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on

# Archive settings (optional but recommended)
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'
```

Edit `pg_hba.conf` on primary:

```conf
# Allow replication connections
host    replication     replication     replica-ip/32     md5
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 2. Create Replication User

```sql
-- On primary database
CREATE USER replication REPLICATION LOGIN ENCRYPTED PASSWORD 'replication_password';
```

### 3. Set Up Replica Server

```bash
# Stop PostgreSQL on replica
sudo systemctl stop postgresql

# Remove existing data directory
sudo rm -rf /var/lib/postgresql/15/main/*

# Create base backup from primary
sudo -u postgres pg_basebackup \
  -h primary-host \
  -D /var/lib/postgresql/15/main \
  -U replication \
  -P \
  -v \
  -R \
  -X stream \
  -C -S replica_slot

# Start PostgreSQL on replica
sudo systemctl start postgresql
```

### 4. Verify Replication

On primary:

```sql
-- Check replication status
SELECT * FROM pg_stat_replication;

-- Check replication slots
SELECT * FROM pg_replication_slots;
```

On replica:

```sql
-- Check if in recovery mode (replica)
SELECT pg_is_in_recovery();
-- Should return: true

-- Check replication lag
SELECT 
  now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

## Docker Setup

### Docker Compose with Replication

```yaml
version: '3.8'

services:
  postgres-primary:
    image: postgres:15-alpine
    container_name: hospitality-postgres-primary
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=hospitality_platform
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_REPLICATION_USER=replication
      - POSTGRES_REPLICATION_PASSWORD=replication_password
    volumes:
      - postgres-primary-data:/var/lib/postgresql/data
      - ./init-primary.sh:/docker-entrypoint-initdb.d/init-primary.sh
    command: >
      postgres
      -c wal_level=replica
      -c max_wal_senders=10
      -c max_replication_slots=10
      -c hot_standby=on
    networks:
      - hospitality-network

  postgres-replica:
    image: postgres:15-alpine
    container_name: hospitality-postgres-replica
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_DB=hospitality_platform
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres-replica-data:/var/lib/postgresql/data
    command: >
      bash -c "
      if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
        pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replication -Fp -Xs -P -R
      fi
      postgres -c hot_standby=on
      "
    depends_on:
      - postgres-primary
    networks:
      - hospitality-network

  pgbouncer-primary:
    image: edoburu/pgbouncer:latest
    container_name: hospitality-pgbouncer-primary
    restart: unless-stopped
    ports:
      - "6432:6432"
    environment:
      - DATABASES_HOST=postgres-primary
      - DATABASES_PORT=5432
      - DATABASES_USER=postgres
      - DATABASES_PASSWORD=postgres
      - DATABASES_DBNAME=hospitality_platform
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=1000
      - DEFAULT_POOL_SIZE=25
    depends_on:
      - postgres-primary
    networks:
      - hospitality-network

  pgbouncer-replica:
    image: edoburu/pgbouncer:latest
    container_name: hospitality-pgbouncer-replica
    restart: unless-stopped
    ports:
      - "6433:6432"
    environment:
      - DATABASES_HOST=postgres-replica
      - DATABASES_PORT=5432
      - DATABASES_USER=postgres
      - DATABASES_PASSWORD=postgres
      - DATABASES_DBNAME=hospitality_platform
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=1000
      - DEFAULT_POOL_SIZE=50
    depends_on:
      - postgres-replica
    networks:
      - hospitality-network

networks:
  hospitality-network:
    driver: bridge

volumes:
  postgres-primary-data:
  postgres-replica-data:
```

## Replica Manager API Endpoints

The replica manager exposes several monitoring endpoints:

### Health Check

```bash
GET /database/replica/health

Response:
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

### Replica Statistics

```bash
GET /database/replica/stats

Response:
{
  "replicaCount": 1,
  "currentReplicaIndex": 0,
  "replicas": {
    "read_replica": {
      "status": "healthy",
      "connectionCount": 25
    }
  }
}
```

### Replication Lag

```bash
GET /database/replica/lag

Response:
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

```bash
GET /database/replica/pool-stats

Response:
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

### Database Info

```bash
GET /database/info

Response:
{
  "primaryConnected": true,
  "replicasEnabled": true,
  "replicaCount": 1,
  "hasReadReplicas": true,
  "timestamp": "2024-11-07T10:00:00Z"
}
```

## Usage in Application Code

### Automatic Read/Write Splitting

```typescript
import { replicaManager } from './database/replica_manager';

// Write operations automatically go to primary
const result = await replicaManager.routeQuery(
  'INSERT',
  'INSERT INTO properties (name, address) VALUES ($1, $2)',
  ['Hotel California', '123 Main St']
);

// Read operations automatically go to replica (with fallback to primary)
const properties = await replicaManager.routeQuery(
  'SELECT',
  'SELECT * FROM properties WHERE org_id = $1',
  [orgId]
);
```

### Direct Database Access

```typescript
import { replicaManager } from './database/replica_manager';

// Get primary database for writes
const primaryDb = replicaManager.getWriteDatabase();
await primaryDb.exec('INSERT INTO ...', []);

// Get read replica for reads
const replicaDb = replicaManager.getReadReplica();
const results = await replicaDb.exec('SELECT * FROM ...', []);
```

### Check Replica Availability

```typescript
import { replicaManager } from './database/replica_manager';

if (replicaManager.hasReadReplicas()) {
  // Use optimized read path
  const data = await fetchFromReplica();
} else {
  // Fallback to primary
  const data = await fetchFromPrimary();
}
```

## Monitoring and Alerting

### Health Check Script

```bash
#!/bin/bash
# replica_health_check.sh

HEALTH_ENDPOINT="http://localhost:4000/database/replica/health"

response=$(curl -s $HEALTH_ENDPOINT)
healthy=$(echo $response | jq -r '.healthy')

if [ "$healthy" != "true" ]; then
    echo "ALERT: Replica health check failed!"
    echo $response
    exit 1
fi

echo "Replica health check passed"
exit 0
```

### Lag Monitoring Script

```bash
#!/bin/bash
# replica_lag_monitor.sh

LAG_ENDPOINT="http://localhost:4000/database/replica/lag"
MAX_LAG_THRESHOLD=30  # seconds

response=$(curl -s $LAG_ENDPOINT)
maxLag=$(echo $response | jq -r '.maxLag')

if (( $(echo "$maxLag > $MAX_LAG_THRESHOLD" | bc -l) )); then
    echo "ALERT: Replica lag is $maxLag seconds (threshold: $MAX_LAG_THRESHOLD)"
    exit 1
fi

echo "Replica lag is acceptable: $maxLag seconds"
exit 0
```

### Prometheus Metrics

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'replica-manager'
    scrape_interval: 15s
    metrics_path: '/database/replica/stats'
    static_configs:
      - targets: ['localhost:4000']
```

## Troubleshooting

### Replica Not Connecting

```bash
# Check replica health
curl http://localhost:4000/database/replica/health

# Check PostgreSQL logs on replica
tail -f /var/log/postgresql/postgresql-15-main.log

# Verify replication connection from primary
psql -h primary-host -U postgres -d hospitality_platform -c "SELECT * FROM pg_stat_replication;"
```

### High Replication Lag

```bash
# Check current lag
curl http://localhost:4000/database/replica/lag

# Check network latency between primary and replica
ping replica-host

# Check disk I/O on replica
iostat -x 1

# Check if replica is behind on WAL replay
psql -h replica-host -U postgres -d hospitality_platform -c "
  SELECT 
    pg_last_wal_receive_lsn() AS receive_lsn,
    pg_last_wal_replay_lsn() AS replay_lsn,
    pg_last_wal_receive_lsn() - pg_last_wal_replay_lsn() AS lag_bytes
"
```

### Connection Pool Exhaustion

```bash
# Check pool stats
curl http://localhost:4000/database/replica/pool-stats

# Check PgBouncer status
psql -h localhost -p 6432 -U postgres -d pgbouncer -c "SHOW POOLS;"

# Increase pool size temporarily (in PgBouncer admin)
psql -h localhost -p 6432 -U postgres -d pgbouncer -c "SET default_pool_size = 50; RELOAD;"
```

## Best Practices

1. **Monitor Replication Lag**: Set up alerts for lag > 10 seconds
2. **Use Transaction Pooling**: Configure PgBouncer with transaction mode
3. **Separate Replica Networks**: Use dedicated network for replication traffic
4. **Regular Testing**: Test replica failover scenarios
5. **Backup Strategy**: Don't rely on replicas as backups
6. **Connection Limits**: Set appropriate pool sizes based on workload
7. **Gradual Rollout**: Enable replicas in dev → staging → production
8. **Read-After-Write**: Consider consistency requirements for read-after-write scenarios
9. **Monitoring**: Track connection counts, query times, and lag metrics
10. **Documentation**: Document your replica topology and failover procedures

## Performance Considerations

### Read Query Distribution

- **80/20 Rule**: ~80% of queries are reads, benefit most from replicas
- **Load Balancing**: Round-robin ensures even distribution
- **Connection Pooling**: Reduces overhead with PgBouncer

### Scaling Guidelines

| Organizations | Replicas | Primary Pool | Replica Pool |
|--------------|----------|--------------|--------------|
| 0-100K       | 0-1      | 25           | 25           |
| 100K-500K    | 1-2      | 50           | 50           |
| 500K-1M      | 2-3      | 100          | 100          |
| 1M+          | 3-5      | 150          | 150          |

## Next Steps

1. Set up PostgreSQL replication (primary + replica)
2. Configure PgBouncer for both primary and replica
3. Set environment variable `USE_READ_REPLICAS=true`
4. Restart application to initialize replica manager
5. Verify health endpoint shows replicas as healthy
6. Monitor replication lag and connection pools
7. Gradually route read traffic to replicas
8. Set up monitoring and alerting
9. Document topology for operations team
10. Test failover scenarios

## Resources

- PostgreSQL Replication: https://www.postgresql.org/docs/current/high-availability.html
- PgBouncer Setup: See `pgbouncer_setup.md`
- Replica Manager Code: `backend/database/replica_manager.ts`
- Monitoring Endpoints: `backend/database/replica_service.ts`

