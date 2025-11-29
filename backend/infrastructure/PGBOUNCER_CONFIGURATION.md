# PgBouncer Configuration Guide

## Overview
PgBouncer is a lightweight connection pooler for PostgreSQL that significantly improves database performance by reusing connections. This guide covers PgBouncer setup for the hospitality management platform.

## Why PgBouncer?

### Benefits
- **Connection Pooling**: Reduces connection overhead by reusing existing connections
- **Scalability**: Support 1000s of client connections with only 100s of PostgreSQL connections
- **Performance**: 10-100x improvement in connection latency
- **Resource Efficiency**: Lower memory usage on PostgreSQL server

### Use Cases
- High-concurrency applications (1M organizations)
- Microservices architecture with many service instances
- Serverless deployments with frequent connection churn
- Cost optimization (fewer database connections = smaller instances)

## Architecture

```
┌─────────────────┐
│ Encore Services │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    PgBouncer    │ ← Connection Pooler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │ ← Primary Database
└─────────────────┘
```

## Installation Options

### Option 1: Docker (Recommended for Development)

```bash
# Create docker-compose.pgbouncer.yml
cat > docker-compose.pgbouncer.yml << 'EOF'
version: '3.8'

services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/hospitality_platform
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=10000
      - DEFAULT_POOL_SIZE=100
      - MIN_POOL_SIZE=10
      - RESERVE_POOL_SIZE=10
      - RESERVE_POOL_TIMEOUT=5
      - MAX_DB_CONNECTIONS=100
      - MAX_USER_CONNECTIONS=10000
    ports:
      - "6432:6432"
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=hospitality_platform
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
EOF

# Start services
docker-compose -f docker-compose.pgbouncer.yml up -d
```

### Option 2: System Installation (Linux)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y pgbouncer

# CentOS/RHEL
sudo yum install -y pgbouncer

# macOS
brew install pgbouncer
```

### Option 3: Cloud-Managed PgBouncer

#### AWS RDS Proxy
```bash
# Create RDS Proxy via AWS Console or CLI
aws rds create-db-proxy \
  --db-proxy-name hospitality-proxy \
  --engine-family POSTGRESQL \
  --auth {JSON_CONFIG} \
  --role-arn arn:aws:iam::ACCOUNT:role/RDSProxyRole \
  --vpc-subnet-ids subnet-xxx subnet-yyy \
  --require-tls
```

#### Google Cloud SQL Proxy
```bash
# Install Cloud SQL Proxy
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
chmod +x cloud_sql_proxy

# Run proxy
./cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432
```

## Configuration

### PgBouncer Configuration File

Create `/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
hospitality_platform = host=localhost port=5432 dbname=hospitality_platform

[pgbouncer]
# Connection settings
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings for 1M organizations
pool_mode = transaction
max_client_conn = 10000
default_pool_size = 100
min_pool_size = 10
reserve_pool_size = 10
reserve_pool_timeout = 5

# Connection limits
max_db_connections = 100
max_user_connections = 10000

# Timeouts
server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0
client_login_timeout = 60

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60

# Advanced settings
ignore_startup_parameters = extra_float_digits

# Performance tuning
tcp_keepalive = 1
tcp_keepcnt = 5
tcp_keepidle = 30
tcp_keepintvl = 10
```

### User Authentication

Create `/etc/pgbouncer/userlist.txt`:

```txt
"hospitality_user" "md5xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Generate MD5 hash:
```bash
echo -n "passwordhospitality_user" | md5sum
```

## Encore Integration

### Update Database Connection String

```typescript
// backend/config/database.ts
export const getDatabaseConfig = () => {
  const usePgBouncer = process.env.USE_PGBOUNCER === 'true';
  
  return {
    host: usePgBouncer 
      ? process.env.PGBOUNCER_HOST || 'localhost'
      : process.env.DB_HOST || 'localhost',
    port: usePgBouncer 
      ? parseInt(process.env.PGBOUNCER_PORT || '6432')
      : parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'hospitality_platform',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
};
```

### Environment Variables

```bash
# Enable PgBouncer
USE_PGBOUNCER=true

# PgBouncer connection details
PGBOUNCER_HOST=localhost
PGBOUNCER_PORT=6432

# Database credentials (same as before)
DB_NAME=hospitality_platform
DB_USER=hospitality_user
DB_PASSWORD=your-password-here
```

## Pool Mode Selection

### Transaction Mode (Recommended)
```ini
pool_mode = transaction
```
- **Best for**: Most applications, microservices
- **Pros**: Best connection reuse, highest scalability
- **Cons**: Cannot use prepared statements, temporary tables
- **Use case**: Encore services with short transactions

### Session Mode
```ini
pool_mode = session
```
- **Best for**: Applications needing session state
- **Pros**: Compatible with all PostgreSQL features
- **Cons**: Lower connection reuse
- **Use case**: Long-running sessions, prepared statements

### Statement Mode
```ini
pool_mode = statement
```
- **Best for**: Very simple queries
- **Pros**: Maximum connection reuse
- **Cons**: No transactions
- **Use case**: Read-only queries, caching

## Monitoring

### Check PgBouncer Status

```bash
# Connect to PgBouncer admin console
psql -h localhost -p 6432 -U pgbouncer pgbouncer

# Show pools
SHOW POOLS;

# Show clients
SHOW CLIENTS;

# Show servers
SHOW SERVERS;

# Show statistics
SHOW STATS;

# Show configuration
SHOW CONFIG;
```

### Key Metrics to Monitor

1. **Active Connections**
   ```sql
   SHOW POOLS;
   -- Monitor: cl_active, cl_waiting, sv_active, sv_idle
   ```

2. **Connection Queue**
   ```sql
   SHOW STATS;
   -- Monitor: total_query_time, avg_query_time
   ```

3. **Pool Saturation**
   - Alert if `cl_waiting > 0` consistently
   - Alert if `sv_active` approaches `default_pool_size`

### Monitoring Endpoint

```typescript
// backend/database/pgbouncer_monitoring.ts
import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const pgbouncerAdmin = SQLDatabase.named("pgbouncer_admin");

export const getPgBouncerStats = api(
  { expose: true, method: "GET", path: "/database/pgbouncer/stats" },
  async (): Promise<any> => {
    try {
      const pools = await pgbouncerAdmin.query`SHOW POOLS`;
      const stats = await pgbouncerAdmin.query`SHOW STATS`;
      
      return {
        timestamp: new Date().toISOString(),
        pools: pools,
        stats: stats,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
);
```

## Performance Tuning

### For 1M Organizations

```ini
# High-throughput configuration
max_client_conn = 10000        # Support 10K concurrent clients
default_pool_size = 200        # 200 connections per database
min_pool_size = 20             # Keep 20 warm connections
reserve_pool_size = 20         # Reserve for important queries
max_db_connections = 200       # Total limit to PostgreSQL

# Aggressive timeouts
server_idle_timeout = 300      # Close idle server connections after 5min
query_timeout = 30             # Kill queries > 30s
query_wait_timeout = 60        # Max time in queue
```

### Connection Pool Sizing

Formula: `default_pool_size = (cores × 2) + effective_spindle_count`

**Example for 8-core database**:
- `(8 × 2) + 1 = 17` (single SSD)
- Round up to 20-50 for safety margin
- Production recommended: 100-200

## Troubleshooting

### Issue: Connection Queue Building Up
```ini
# Increase pool size
default_pool_size = 150

# Reduce timeouts
query_wait_timeout = 30
```

### Issue: "No more connections allowed"
```ini
# Increase client limit
max_client_conn = 15000

# Or increase database limit
max_db_connections = 200
```

### Issue: Prepared Statement Errors
```ini
# Switch to session mode
pool_mode = session
```

### Issue: High Latency
```bash
# Check if PgBouncer is the bottleneck
psql -h localhost -p 6432 pgbouncer -c "SHOW STATS;"

# Look for high avg_query_time or total_wait_time
```

## High Availability

### Multiple PgBouncer Instances

```bash
# Run multiple PgBouncer instances with load balancer
# Instance 1
pgbouncer -d /etc/pgbouncer/pgbouncer1.ini

# Instance 2
pgbouncer -d /etc/pgbouncer/pgbouncer2.ini

# Use HAProxy or similar for load balancing
```

### Failover Configuration

```ini
[databases]
hospitality_platform = host=primary-db,replica-db port=5432 dbname=hospitality_platform
```

## Security

### SSL/TLS Configuration

```ini
[pgbouncer]
server_tls_sslmode = require
server_tls_ca_file = /etc/ssl/certs/ca-cert.pem
server_tls_key_file = /etc/ssl/private/server-key.pem
server_tls_cert_file = /etc/ssl/certs/server-cert.pem

client_tls_sslmode = allow
client_tls_key_file = /etc/ssl/private/pgbouncer-key.pem
client_tls_cert_file = /etc/ssl/certs/pgbouncer-cert.pem
```

### Firewall Rules

```bash
# Allow only Encore services to connect
iptables -A INPUT -p tcp --dport 6432 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 6432 -j DROP
```

## Cost Impact

### Without PgBouncer
- **Database Instance**: db.r5.2xlarge ($700/month)
- **Connections**: Need large instance for connection handling

### With PgBouncer
- **Database Instance**: db.r5.large ($350/month)
- **PgBouncer**: t3.medium ($30/month)
- **Total Savings**: ~$320/month (45% reduction)

## Verification

### Test PgBouncer Connection

```bash
# Test direct connection
psql -h localhost -p 6432 -U hospitality_user -d hospitality_platform -c "SELECT 1;"

# Check connection pooling
psql -h localhost -p 6432 pgbouncer -c "SHOW POOLS;"
```

### Load Testing

```bash
# Run concurrent connections test
for i in {1..1000}; do
  psql -h localhost -p 6432 -U hospitality_user -d hospitality_platform -c "SELECT pg_sleep(0.1);" &
done

# Monitor pool usage
watch -n 1 'psql -h localhost -p 6432 pgbouncer -t -c "SHOW POOLS;"'
```

## Rollback Plan

If PgBouncer causes issues:

```bash
# 1. Stop routing through PgBouncer
export USE_PGBOUNCER=false

# 2. Restart application
encore app restart

# 3. Verify direct database connection works
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

## Next Steps

1. ✅ Install PgBouncer (Docker or system)
2. ✅ Configure pool settings for your workload
3. ✅ Update connection strings to use PgBouncer
4. ✅ Monitor pools and tune parameters
5. ✅ Set up alerts for pool saturation
6. ✅ Document configuration in runbook

## Support

For issues:
1. Check PgBouncer logs: `/var/log/pgbouncer/pgbouncer.log`
2. Review SHOW POOLS output
3. Verify PostgreSQL connectivity
4. Contact DevOps team

## References

- PgBouncer Documentation: https://www.pgbouncer.org/
- Connection Pooling Best Practices: https://wiki.postgresql.org/wiki/PgBouncer
- Encore Database Guide: https://encore.dev/docs/develop/databases

