# PgBouncer Setup Guide

## Overview

PgBouncer is a lightweight connection pooler for PostgreSQL that significantly reduces connection overhead and improves scalability for the hospitality platform.

## Why PgBouncer?

- **Connection Pooling**: Reduces connection overhead (PostgreSQL forks a new process per connection)
- **Scalability**: Handles 1000s of client connections with only 100s of server connections
- **Performance**: Transaction-level pooling minimizes latency
- **Resource Efficiency**: Lower memory footprint on database server
- **High Availability**: Can route to multiple database servers

## Installation

### Ubuntu/Debian

```bash
# Install PgBouncer
sudo apt-get update
sudo apt-get install -y pgbouncer

# Verify installation
pgbouncer --version
```

### CentOS/RHEL

```bash
# Install PgBouncer
sudo yum install -y epel-release
sudo yum install -y pgbouncer

# Verify installation
pgbouncer --version
```

### Docker

```bash
# Use official PgBouncer Docker image
docker run -d \
  --name pgbouncer \
  -p 6432:6432 \
  -v $(pwd)/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
  -v $(pwd)/userlist.txt:/etc/pgbouncer/userlist.txt \
  edoburu/pgbouncer:latest
```

### Docker Compose

```yaml
# Add to docker-compose.yml
version: '3.8'

services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: hospitality-pgbouncer
    restart: unless-stopped
    ports:
      - "6432:6432"
    volumes:
      - ./infrastructure/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
      - ./infrastructure/userlist.txt:/etc/pgbouncer/userlist.txt:ro
    environment:
      - DATABASES_HOST=postgres
      - DATABASES_PORT=5432
      - DATABASES_USER=postgres
      - DATABASES_PASSWORD=postgres
      - DATABASES_DBNAME=hospitality_platform
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=1000
      - DEFAULT_POOL_SIZE=25
    depends_on:
      - postgres
    networks:
      - hospitality-network

  postgres:
    image: postgres:15-alpine
    container_name: hospitality-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=hospitality_platform
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - hospitality-network

networks:
  hospitality-network:
    driver: bridge

volumes:
  postgres-data:
```

## Configuration

### 1. Create User List File

Create `/etc/pgbouncer/userlist.txt`:

```text
"postgres" "md5<md5_hash_of_password>"
"app_user" "md5<md5_hash_of_password>"
```

Generate MD5 hash:

```bash
# Generate MD5 hash for password
echo -n "passwordusername" | md5sum

# Example: For user 'postgres' with password 'postgres'
echo -n "postgrespostgres" | md5sum
# Output: <hash>
# Add to userlist.txt as: "postgres" "md5<hash>"
```

### 2. Configure PgBouncer

Copy the provided `pgbouncer.ini` to `/etc/pgbouncer/pgbouncer.ini`.

Key configurations to adjust:

```ini
[databases]
; Update with your actual database connection details
hospitality = host=localhost port=5432 dbname=hospitality_platform user=postgres password=postgres

[pgbouncer]
; Adjust based on your workload
pool_mode = transaction          ; transaction, session, or statement
default_pool_size = 25           ; Connections per user/database
max_client_conn = 1000           ; Maximum client connections
max_db_connections = 100         ; Maximum database connections
```

### 3. Set Permissions

```bash
# Set correct ownership
sudo chown -R postgres:postgres /etc/pgbouncer/
sudo chmod 640 /etc/pgbouncer/pgbouncer.ini
sudo chmod 640 /etc/pgbouncer/userlist.txt

# Create log directory
sudo mkdir -p /var/log/pgbouncer
sudo chown postgres:postgres /var/log/pgbouncer

# Create run directory
sudo mkdir -p /var/run/pgbouncer
sudo chown postgres:postgres /var/run/pgbouncer
```

## Starting PgBouncer

### Systemd (Ubuntu/Debian)

```bash
# Enable and start PgBouncer
sudo systemctl enable pgbouncer
sudo systemctl start pgbouncer

# Check status
sudo systemctl status pgbouncer

# View logs
sudo journalctl -u pgbouncer -f
```

### Manual Start

```bash
# Start PgBouncer
sudo -u postgres pgbouncer -d /etc/pgbouncer/pgbouncer.ini

# Check if running
ps aux | grep pgbouncer

# View logs
tail -f /var/log/pgbouncer/pgbouncer.log
```

## Application Configuration

### Update Environment Variables

```bash
# Update database connection to use PgBouncer
DB_HOST=localhost
DB_PORT=6432          # PgBouncer port instead of 5432
DB_NAME=hospitality_platform
DB_USER=postgres
DB_PASSWORD=postgres

# Connection pool settings (application-level)
DB_MAX_CONNECTIONS=100      # Should match PgBouncer's max_db_connections
DB_MIN_CONNECTIONS=10
DB_CONNECTION_TIMEOUT=30s
DB_QUERY_TIMEOUT=60s
```

### Update Encore Database Configuration

Update `backend/encore.app`:

```json
{
  "databases": {
    "hospitality": {
      "host": "localhost",
      "port": 6432,
      "database": "hospitality_platform",
      "user": "postgres",
      "password": "postgres"
    }
  }
}
```

Or use connection string:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:6432/hospitality_platform?pool_timeout=30"
```

## Monitoring PgBouncer

### Admin Console

Connect to PgBouncer admin console:

```bash
psql -h localhost -p 6432 -U postgres -d pgbouncer
```

### Admin Commands

```sql
-- Show all databases
SHOW DATABASES;

-- Show connection pools
SHOW POOLS;

-- Show active clients
SHOW CLIENTS;

-- Show active servers
SHOW SERVERS;

-- Show statistics
SHOW STATS;

-- Show configuration
SHOW CONFIG;

-- Reload configuration
RELOAD;

-- Pause all connections
PAUSE;

-- Resume connections
RESUME;

-- Shut down PgBouncer gracefully
SHUTDOWN;
```

### Key Metrics to Monitor

```sql
-- Pool utilization
SHOW POOLS;
-- Check: cl_active, cl_waiting, sv_active, sv_idle

-- Client connections
SHOW CLIENTS;
-- Monitor: Total clients, waiting clients

-- Server connections
SHOW SERVERS;
-- Monitor: Active servers, idle servers

-- Statistics
SHOW STATS;
-- Monitor: total_query_time, avg_query_time, avg_wait_time
```

### Automated Monitoring Script

```bash
#!/bin/bash
# pgbouncer_monitor.sh

PGBOUNCER_HOST="localhost"
PGBOUNCER_PORT="6432"
PGBOUNCER_USER="postgres"

# Get pool stats
psql -h $PGBOUNCER_HOST -p $PGBOUNCER_PORT -U $PGBOUNCER_USER -d pgbouncer -t -c "SHOW POOLS;" | \
while read -r line; do
    echo "Pool Stats: $line"
done

# Get statistics
psql -h $PGBOUNCER_HOST -p $PGBOUNCER_PORT -U $PGBOUNCER_USER -d pgbouncer -t -c "SHOW STATS;" | \
while read -r line; do
    echo "Stats: $line"
done

# Check for waiting clients (potential bottleneck)
waiting_clients=$(psql -h $PGBOUNCER_HOST -p $PGBOUNCER_PORT -U $PGBOUNCER_USER -d pgbouncer -t -c "SHOW POOLS;" | awk '{sum+=$4} END {print sum}')

if [ "$waiting_clients" -gt 10 ]; then
    echo "WARNING: $waiting_clients clients waiting for connections"
fi
```

## Tuning Guidelines

### Pool Mode Selection

```ini
; Transaction mode (recommended for most applications)
pool_mode = transaction
; - Connections returned to pool after each transaction
; - Best balance of efficiency and compatibility
; - Suitable for REST APIs and microservices

; Session mode (for applications requiring persistent sessions)
pool_mode = session
; - Connection released only when client disconnects
; - Required for prepared statements across transactions
; - Lower connection reuse

; Statement mode (aggressive pooling)
pool_mode = statement
; - Connection released after each statement
; - Maximum connection reuse
; - May break some applications
```

### Pool Size Calculations

```ini
; Formula: default_pool_size = (expected_concurrent_queries / number_of_application_instances)

; Example for 1M organizations:
; - Expected concurrent queries: 500
; - Application instances: 10
; - Pool size per instance: 500 / 10 = 50

default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 10
max_db_connections = 100

; Max client connections should be higher than pool size
max_client_conn = 1000
```

### Performance Optimization

```ini
; Enable SO_REUSEPORT for better multi-core scaling
so_reuseport = 1

; TCP keepalive settings
tcp_keepalive = 1
tcp_keepcnt = 5
tcp_keepidle = 30
tcp_keepintvl = 10

; Increase packet buffer for high throughput
pkt_buf = 8192

; Faster query timeout detection
query_wait_timeout = 120
```

## High Availability Setup

### Multiple PgBouncer Instances

```ini
; Instance 1: pgbouncer-1.ini
listen_addr = 0.0.0.0
listen_port = 6432

; Instance 2: pgbouncer-2.ini
listen_addr = 0.0.0.0
listen_port = 6433
```

### Load Balancer Configuration (HAProxy)

```cfg
# haproxy.cfg
global
    maxconn 4096

defaults
    mode tcp
    timeout connect 10s
    timeout client 1h
    timeout server 1h

frontend pgbouncer_front
    bind *:5432
    default_backend pgbouncer_back

backend pgbouncer_back
    balance roundrobin
    server pgbouncer1 localhost:6432 check
    server pgbouncer2 localhost:6433 check
```

## Troubleshooting

### Connection Issues

```bash
# Test PgBouncer connection
psql -h localhost -p 6432 -U postgres -d hospitality_platform

# Check PgBouncer logs
tail -f /var/log/pgbouncer/pgbouncer.log

# Verify PgBouncer is listening
netstat -tulpn | grep 6432
```

### Pool Exhaustion

```sql
-- Check for waiting clients
SHOW POOLS;

-- Increase pool size temporarily
SET default_pool_size = 50;
RELOAD;
```

### Slow Queries

```sql
-- Monitor query times
SHOW STATS;

-- Check for long-running transactions
SHOW CLIENTS;
```

### Configuration Errors

```bash
# Validate configuration
pgbouncer -R /etc/pgbouncer/pgbouncer.ini

# Test with verbose logging
pgbouncer -v /etc/pgbouncer/pgbouncer.ini
```

## Best Practices

1. **Use Transaction Mode**: Best for REST APIs and stateless applications
2. **Monitor Pool Utilization**: Ensure pools aren't consistently full
3. **Set Appropriate Timeouts**: Prevent hung connections
4. **Regular Log Review**: Monitor for errors and warnings
5. **Load Testing**: Validate pool sizes under realistic load
6. **Gradual Rollout**: Start with development, then staging, then production
7. **Backup Configuration**: Version control pgbouncer.ini
8. **Security**: Use TLS for production environments
9. **Monitoring**: Integrate with monitoring stack (Prometheus, Grafana)
10. **Documentation**: Document your specific pool size calculations

## Integration with Replica Manager

The replica manager can use PgBouncer for both primary and replica connections:

```bash
# Primary (write) connections
PRIMARY_DB_HOST=localhost
PRIMARY_DB_PORT=6432  # PgBouncer for primary

# Replica (read) connections  
REPLICA_DB_HOST=localhost
REPLICA_DB_PORT=6433  # PgBouncer for replica
```

## Security Considerations

```ini
; Authentication
auth_type = md5              ; Use MD5 or stronger
auth_file = /etc/pgbouncer/userlist.txt

; TLS/SSL (production)
client_tls_sslmode = require
client_tls_cert_file = /path/to/cert.pem
client_tls_key_file = /path/to/key.pem

; Restrict admin access
admin_users = postgres
stats_users = monitoring

; Disable dangerous commands
ignore_startup_parameters = extra_float_digits
```

## Next Steps

1. Install PgBouncer using preferred method
2. Configure `pgbouncer.ini` with appropriate pool sizes
3. Create `userlist.txt` with MD5 hashed passwords
4. Start PgBouncer and verify it's running
5. Update application database connection settings
6. Test connections through PgBouncer
7. Monitor pool utilization and adjust settings
8. Integrate with replica manager
9. Set up monitoring and alerting
10. Document configuration for team

## Resources

- PgBouncer Documentation: https://www.pgbouncer.org/
- GitHub: https://github.com/pgbouncer/pgbouncer
- Configuration Reference: https://www.pgbouncer.org/config.html
- FAQ: https://www.pgbouncer.org/faq.html

