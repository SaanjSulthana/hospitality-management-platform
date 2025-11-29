# Dashboards and Alerts - 1M Organization Scaling

This document provides templates and configuration for monitoring dashboards and alerts to ensure the system performs optimally at scale.

## Table of Contents
- [Grafana Dashboards](#grafana-dashboards)
- [Alert Policies](#alert-policies)
- [Runbooks](#runbooks)
- [Metrics Reference](#metrics-reference)

---

## Grafana Dashboards

### 1. System Overview Dashboard

**Purpose**: High-level view of system health and performance

**Panels**:

1. **Request Rate (RPS)**
   - Query: `rate(http_requests_total[5m])`
   - Type: Graph
   - Threshold: >5000 RPS (green), 2500-5000 (yellow), <2500 (red)

2. **Response Time (P95)**
   - Query: `histogram_quantile(0.95, http_request_duration_seconds_bucket)`
   - Type: Graph
   - Threshold: <500ms (green), 500-1000ms (yellow), >1000ms (red)

3. **Error Rate**
   - Query: `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])`
   - Type: Gauge
   - Threshold: <0.5% (green), 0.5-1% (yellow), >1% (red)

4. **Cache Hit Rate**
   - Query: `cache_hits_total / (cache_hits_total + cache_misses_total)`
   - Type: Gauge
   - Threshold: >85% (green), 80-85% (yellow), <80% (red)

5. **Database Connection Pool**
   - Query: `pg_pool_connections_active / pg_pool_connections_max`
   - Type: Gauge
   - Threshold: <70% (green), 70-90% (yellow), >90% (red)

6. **Active Organizations**
   - Query: `count(distinct(org_id))`
   - Type: Stat
   - Display: Number with trend

### 2. Pub/Sub Performance Dashboard

**Purpose**: Monitor event processing and message queue health

**Panels**:

1. **Events Per Second**
   - Query: `rate(pubsub_messages_published_total[1m])`
   - Type: Graph
   - Threshold: >5000 (green), 2500-5000 (yellow), <2500 (red)

2. **Message Processing Time**
   - Query: `histogram_quantile(0.95, pubsub_message_processing_duration_seconds_bucket)`
   - Type: Graph
   - Threshold: <100ms (green), 100-500ms (yellow), >500ms (red)

3. **Message Backlog**
   - Query: `pubsub_subscription_num_undelivered_messages`
   - Type: Graph
   - Threshold: <1000 (green), 1000-10000 (yellow), >10000 (red)

4. **Acknowledgement Rate**
   - Query: `rate(pubsub_messages_acknowledged_total[5m])`
   - Type: Graph

5. **Dead Letter Queue Size**
   - Query: `pubsub_dead_letter_queue_size`
   - Type: Stat
   - Alert: >100 messages

### 3. Database Performance Dashboard

**Purpose**: Monitor database health, partitioning, and read replica performance

**Panels**:

1. **Query Duration (P95)**
   - Query: `histogram_quantile(0.95, pg_query_duration_seconds_bucket)`
   - Type: Graph
   - Threshold: <500ms (green), 500-1000ms (yellow), >1000ms (red)

2. **Partition Distribution**
   - Query: `count(pg_stat_user_tables{tablename=~".*_[0-9]+"})`
   - Type: Bar Graph
   - Display: Queries per partition

3. **Read Replica Load**
   - Query: `rate(pg_replica_queries_total[5m]) / rate(pg_queries_total[5m])`
   - Type: Gauge
   - Threshold: >40% (green), 20-40% (yellow), <20% (red)

4. **Partition Health**
   - Query: `pg_partition_size_bytes`
   - Type: Table
   - Display: Size and growth rate per partition

5. **Active Queries**
   - Query: `pg_stat_activity_count`
   - Type: Graph
   - Threshold: <100 (green), 100-200 (yellow), >200 (red)

6. **Connection Pool Utilization**
   - Query: `pg_pool_connections_active / pg_pool_connections_max * 100`
   - Type: Gauge
   - By Database: primary, replicas

### 4. Microservices Dashboard

**Purpose**: Monitor individual microservice health and inter-service communication

**Panels**:

1. **Service Health**
   - Query: `up{job=~"finance-service|reports-service|cache-service|events-service"}`
   - Type: Status Map
   - Display: Green (1), Red (0)

2. **Circuit Breaker Status**
   - Query: `circuit_breaker_state{state=~"OPEN|HALF_OPEN"}`
   - Type: Table
   - Alert: Any circuit breaker open >5 minutes

3. **Service Response Time**
   - Query: `histogram_quantile(0.95, service_request_duration_seconds_bucket)`
   - Type: Graph (by service)

4. **Service Error Rate**
   - Query: `rate(service_errors_total[5m]) / rate(service_requests_total[5m])`
   - Type: Graph (by service)

5. **Inter-Service Call Volume**
   - Query: `rate(service_gateway_requests_total[5m])`
   - Type: Sankey Diagram
   - Display: Call flow between services

### 5. Event Sourcing Dashboard

**Purpose**: Monitor event store performance and read model projections

**Panels**:

1. **Events Appended Per Second**
   - Query: `rate(event_store_events_appended_total[1m])`
   - Type: Graph

2. **Event Store Size**
   - Query: `event_store_size_bytes`
   - Type: Gauge
   - Display: With growth rate

3. **Snapshot Creation Rate**
   - Query: `rate(snapshots_created_total[5m])`
   - Type: Graph

4. **Read Model Lag**
   - Query: `read_model_projection_lag_seconds`
   - Type: Graph
   - Threshold: <60s (green), 60-300s (yellow), >300s (red)

5. **Projection Processing Time**
   - Query: `histogram_quantile(0.95, read_model_projection_duration_seconds_bucket)`
   - Type: Graph

---

## Alert Policies

### Critical Alerts (PagerDuty)

#### 1. High Error Rate
```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
for: 5m
labels:
  severity: critical
annotations:
  summary: "High error rate detected (>1%)"
  description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes"
```

#### 2. System Down
```yaml
alert: SystemDown
expr: up{job="hospitality-platform"} == 0
for: 1m
labels:
  severity: critical
annotations:
  summary: "System is down"
  description: "Hospitality platform has been down for more than 1 minute"
```

#### 3. Database Connection Pool Exhausted
```yaml
alert: DatabasePoolExhausted
expr: pg_pool_connections_active / pg_pool_connections_max > 0.95
for: 2m
labels:
  severity: critical
annotations:
  summary: "Database connection pool nearly exhausted"
  description: "Connection pool is {{ $value | humanizePercentage }} full"
```

#### 4. Message Backlog Critical
```yaml
alert: MessageBacklogCritical
expr: pubsub_subscription_num_undelivered_messages > 50000
for: 10m
labels:
  severity: critical
annotations:
  summary: "Critical message backlog"
  description: "Undelivered messages: {{ $value }}"
```

### Warning Alerts (Slack/Email)

#### 5. Elevated Response Time
```yaml
alert: ElevatedResponseTime
expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 0.5
for: 10m
labels:
  severity: warning
annotations:
  summary: "Elevated response time (>500ms P95)"
  description: "P95 response time is {{ $value }}s"
```

#### 6. Cache Hit Rate Low
```yaml
alert: CacheHitRateLow
expr: cache_hits_total / (cache_hits_total + cache_misses_total) < 0.80
for: 15m
labels:
  severity: warning
annotations:
  summary: "Cache hit rate below threshold (<80%)"
  description: "Cache hit rate: {{ $value | humanizePercentage }}"
```

#### 7. Circuit Breaker Open
```yaml
alert: CircuitBreakerOpen
expr: circuit_breaker_state{state="OPEN"} == 1
for: 5m
labels:
  severity: warning
annotations:
  summary: "Circuit breaker {{ $labels.service }} is OPEN"
  description: "Service {{ $labels.service }} circuit breaker has been open for 5+ minutes"
```

#### 8. Read Replica Lag
```yaml
alert: ReadReplicaLag
expr: pg_replication_lag_seconds > 60
for: 5m
labels:
  severity: warning
annotations:
  summary: "Read replica lagging behind primary"
  description: "Replication lag: {{ $value }}s"
```

#### 9. Partition Imbalance
```yaml
alert: PartitionImbalance
expr: stddev(rate(pg_partition_queries_total[5m])) > 100
for: 15m
labels:
  severity: warning
annotations:
  summary: "Partition query distribution is imbalanced"
  description: "Consider rebalancing partitions"
```

---

## Runbooks

### Runbook 1: High Error Rate Response

**Trigger**: Error rate >1% for 5+ minutes

**Steps**:

1. **Identify Error Type**
   ```bash
   # Check error logs
   grep "ERROR" /var/log/hospitality/*.log | tail -100
   
   # Check error breakdown
   curl http://localhost:9090/api/v1/query?query='rate(http_requests_total{status=~"5.."}[5m]) by (status)'
   ```

2. **Check Recent Deployments**
   - Review recent deployments/changes
   - Consider rollback if deployment occurred in last hour

3. **Check Database Health**
   ```bash
   # Check active connections
   psql -d hospitality -c "SELECT COUNT(*) FROM pg_stat_activity;"
   
   # Check slow queries
   psql -d hospitality -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 seconds';"
   ```

4. **Check Pub/Sub Health**
   ```bash
   # Check message backlog
   curl http://localhost:8080/metrics | grep pubsub_subscription_num_undelivered_messages
   ```

5. **Escalate if Unresolved**
   - Contact DevOps lead after 15 minutes
   - Prepare incident report

### Runbook 2: Database Connection Pool Exhausted

**Trigger**: Connection pool >95% utilized for 2+ minutes

**Steps**:

1. **Identify Active Connections**
   ```sql
   SELECT pid, usename, application_name, client_addr, state, query 
   FROM pg_stat_activity 
   WHERE state != 'idle' 
   ORDER BY query_start DESC;
   ```

2. **Kill Long-Running Queries**
   ```sql
   -- Identify queries running >5 minutes
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' 
   AND now() - query_start > interval '5 minutes'
   AND query NOT LIKE '%pg_stat_activity%';
   ```

3. **Increase Pool Size (Temporary)**
   ```bash
   # Update environment variable
   export DB_MAX_CONNECTIONS=150
   
   # Restart application
   systemctl restart hospitality-platform
   ```

4. **Monitor Recovery**
   - Watch connection pool utilization
   - Check error rate returns to normal

5. **Root Cause Analysis**
   - Review slow query logs
   - Identify connection leaks
   - Optimize problematic queries

### Runbook 3: Circuit Breaker Open

**Trigger**: Circuit breaker open for 5+ minutes

**Steps**:

1. **Identify Affected Service**
   ```bash
   curl http://localhost:8080/circuit-breakers/status
   ```

2. **Check Service Health**
   ```bash
   # Check if service is responding
   curl http://localhost:8080/health/{service}
   
   # Check service logs
   tail -100 /var/log/hospitality/{service}.log
   ```

3. **Reset Circuit Breaker (if appropriate)**
   ```bash
   curl -X POST http://localhost:8080/circuit-breakers/{service}/reset
   ```

4. **Restart Service (if needed)**
   ```bash
   systemctl restart hospitality-{service}
   ```

5. **Monitor Recovery**
   - Watch circuit breaker state
   - Monitor error rates
   - Check dependent services

---

## Metrics Reference

### Key Metrics to Monitor

| Metric | Target | Critical Threshold | Source |
|--------|--------|-------------------|--------|
| Request Rate | 5,000+ RPS | <2,500 RPS | HTTP metrics |
| Response Time (P95) | <500ms | >1,000ms | HTTP metrics |
| Error Rate | <0.5% | >1% | HTTP metrics |
| Cache Hit Rate | >85% | <80% | Cache service |
| DB Query Time (P95) | <500ms | >1,000ms | PostgreSQL |
| Events Per Second | 5,000+ | <2,500 | Pub/Sub metrics |
| Message Backlog | <1,000 | >10,000 | Pub/Sub metrics |
| Circuit Breaker State | CLOSED | OPEN >5min | Resilience metrics |
| Read Replica Lag | <30s | >60s | PostgreSQL replication |
| Partition Balance | Even distribution | >20% variance | Database stats |

### Metric Collection Setup

```typescript
// Example: Instrumenting code for metrics
import { Counter, Histogram, Gauge } from 'prom-client';

// Request counter
const requestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status']
});

// Response time histogram
const responseTimeHistogram = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5]
});

// Cache hit rate gauge
const cacheHitRateGauge = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage'
});
```

---

## Dashboard JSON Export

### System Overview Dashboard JSON

```json
{
  "dashboard": {
    "title": "Hospitality Platform - System Overview",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate (RPS)",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ],
        "type": "graph"
      },
      {
        "id": 2,
        "title": "Response Time (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)",
            "legendFormat": "P95"
          }
        ],
        "type": "graph"
      }
    ],
    "refresh": "10s",
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

---

## Setup Instructions

### 1. Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'hospitality-platform'
    static_configs:
      - targets: ['localhost:8080']
    scrape_interval: 15s
```

### 2. Grafana Data Source

1. Navigate to Configuration → Data Sources
2. Add Prometheus data source
3. URL: `http://localhost:9090`
4. Save & Test

### 3. Import Dashboards

1. Navigate to Dashboards → Import
2. Upload JSON from above or use dashboard ID
3. Select Prometheus data source
4. Import

### 4. Configure Alerting

1. Navigate to Alerting → Contact Points
2. Add contact points (PagerDuty, Slack, Email)
3. Navigate to Alerting → Alert Rules
4. Import alert policies from above

---

## Contact Information

- **DevOps Lead**: devops@example.com
- **On-Call Engineer**: oncall@example.com
- **PagerDuty**: https://example.pagerduty.com
- **Slack**: #platform-alerts

---

**Last Updated**: October 2025  
**Version**: 1.0.0  
**Maintained By**: DevOps Team

