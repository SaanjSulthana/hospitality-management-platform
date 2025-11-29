# 1M Organization Readiness Gap Assessment

**Date:** 2025-10-29  
**Owner:** GPT-5 Codex (analysis for ATIF TEAM EXP)

## Executive Summary

The codebase contains scaffolding for partitioned tables, read replicas, cache invalidation, and event sourcing, but these features remain dormant or partially mocked. As a result, the platform still executes against the monolithic `hospitality` database and in-memory caches, leaving overall capacity far short of the stated 1M-organization target. Immediate work is required to (1) complete data migration and flip the feature flags, (2) replace stubbed infrastructure (replicas, Redis) with real services, and (3) harden observability and load testing before production activation.

## Current Implementation Snapshot

- **Partition tables & routing:** Migration scripts create hash and range partitions with dual-write triggers, yet runtime logic short-circuits to legacy tables whenever `USE_PARTITIONED_TABLES` is unset. That flag defaults to `false` and no caller enables it in code or deployment manifests.
```44:49:backend/database/partitioning_manager.ts
  private initializeFeatureFlags() {
    // Feature flags for gradual migration
    this.featureFlags.set('use_partitioned_tables', process.env.USE_PARTITIONED_TABLES === 'true' || false);
```
```122:127:backend/database/partitioning_manager.ts
  async routeQuery(tableName: string, query: string, params: any[]): Promise<any> {
    if (!this.featureFlags.get('use_partitioned_tables')) {
      // Use original table
      return await this.executeOnOriginalTable(tableName, query, params);
```
- **Partition migrations present:** The Encore database dashboard confirms the `hospitality` schema (along with auxiliary DBs such as `finance`, `event_store`, and `read_models`) has all migrations applied, so the partitioned tables exist on disk; the missing step is toggling traffic and refactoring access so those tables are actually used.
- **Service writes/reads:** Finance and reports services continue to write and query the legacy `revenues`, `expenses`, and `daily_cash_balances` tables directly, bypassing `PartitioningManager` entirely.
```55:64:backend/services/finance-service/finance_service.ts
      await financeDB.exec`
        INSERT INTO revenues (
          org_id, property_id, amount_cents, description,
          payment_mode, occurred_at, status, created_by_user_id, created_at, updated_at
        ) VALUES (
          ${authData.orgId}, ${request.propertyId}, ${request.amount * 100}, ${request.description},
          ${request.paymentMode}, ${occurredAt}, 'pending', ${authData.userId}, NOW(), NOW()
        )
      `;
```
```146:169:backend/services/reports-service/reports_service.ts
    const balanceQuery = propertyId
      ? `SELECT * FROM daily_cash_balances ...`
    const revenuesQuery = propertyId
      ? `SELECT SUM(amount_cents) ... FROM revenues ...`
    const expensesQuery = propertyId
      ? `SELECT SUM(amount_cents) ... FROM expenses ...`
```
- **Read replica manager:** The helper never instantiates replica connections (loop is commented out) and still advances a round-robin index, implying a runtime modulo-by-zero once replicas are added.
```47:71:backend/database/replica_manager.ts
    // Initialize read replicas - Commented out due to missing database definition
    // for (const [name, config] of this.replicaConfigs) {
    //   const replica = SQLDatabase.named("hospitality_replica", {
    //     ...
```
```110:114:backend/database/replica_manager.ts
  private getNextReplica(): string {
    const replicaNames = Array.from(this.readReplicas.keys());
    const replicaName = replicaNames[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicaCount;
```
- **Caching layer:** The so-called Redis service is an in-memory Map within the Encore process, so cache hit rates depend on instance locality and cannot be horizontally scaled.
```1:18:backend/cache/redis_cache_service.ts
// Redis cache service using in-memory Map for now
// TODO: Replace with actual Redis when infrastructure is available
class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
```
- **Event sourcing:** The “Phase 3” event store remains an in-memory Map; it is not wired to the real `event_store` database, so no durable retention or replay is available.
```1:29:backend/eventsourcing/phase3_event_sourcing.ts
export class EventStore {
  private events = new Map<string, DomainEvent[]>();
  private snapshots = new Map<string, Snapshot>();
```

## Activation Gaps & Required Work

### 1. Database Partitioning

- **Finalize data migration:** Run `create_partitioned_tables.sql`, execute the dual-write triggers, backfill data via `switchover_to_partitioned.sh`, and verify row counts before toggling traffic.
- **Prevent trigger duplication:** Update `sync_revenues_insert` and `sync_expenses_insert` to use `ON CONFLICT` upserts; otherwise every update duplicates rows in the partitioned tables.
- **Flip runtime flags:** Promote `USE_PARTITIONED_TABLES=true` and replace direct `financeDB.exec`/`reportsDB.queryRow` usages with helper functions that route through `PartitioningManager`.
- **Add regression tests:** Instrument query builders to confirm partition pruning (e.g., by asserting `EXPLAIN` results target `_partitioned` tables).

### 2. Data Access Layer

- **Create a partition-aware repository:** Encapsulate CRUD for revenues, expenses, and balances so that all services go through a single API; this simplifies toggling and prevents handcrafted SQL from bypassing pruning.
- **Refactor reports service:** Replace raw template strings with parameterized queries and rely on the repository/ORM to handle partition selection.
- **Guard legacy tables:** Once migration succeeds, convert legacy tables to views or block writes to avoid drift.

### 3. Read Replica & Connection Management

- **Provision actual replicas:** Update infrastructure to supply replica DSNs and recreate the commented initialization logic. Ensure PgBouncer (transaction mode) fronts both primary and replicas.
- **Fix round-robin logic:** Handle the `replicaCount===0` case gracefully and add health checks before selecting a replica.
- **Route reads intentionally:** Require services to declare read/write intent instead of ad-hoc string queries; the replica manager should receive high-level commands.

### 4. Caching & Invalidation

- **Deploy Redis/KeyDB cluster:** Replace `SimpleCache` with Encore’s Redis-backed storage or a managed service. Migrate cache keys and add serialization guards.
- **Benchmark async invalidator:** Once Redis is live, run sustained load to tune `batchSize`, retry policies, and defensive invalidation settings.
- **Expand cache metrics:** Expose hit/miss, invalidate counts, and queue depth to the monitoring stack.

### 5. Eventing & Microservices

- **Use the durable event store:** Consolidate on `backend/eventsourcing/event_store.ts` (Postgres-backed) or upgrade Phase 3 code to persist via `eventStoreDB`. Remove the in-memory placeholder.
- **Replayable projections:** Ensure read models feed from the durable event stream so recovery scenarios can rebuild aggregates.
- **Service boundaries:** Confirm Encore service gateways expose only the new microservice endpoints in `encore.service.ts`, and retire the legacy synchronous versions once event-driven flows stabilize.

### 6. Observability & Testing

- **Metrics coverage:** Instrument partition usage, replica lag, cache stats, and async queue throughput. Hook into existing cron jobs (`partitionMaintenance`, `dailyConsistencyCheck`) for alerts.
- **Load tests:** Re-run Phase 1–3 load suites under the activated architecture with 1M-org scale to validate latency, error rates, and resource profiles.
- **Runbooks:** Document operational steps (flag flips, failovers, backfills) and integrate into the ops playbook before production cutover.

## Sequenced Activation Plan

1. **Staging migration rehearsal** – Execute the switchover script in staging, validate parity, and capture performance baselines.
2. **Infrastructure bring-up** – Provision Redis and replicas; update application configuration and connection pooling.
3. **Code refactors** – Centralize data access, enable partition routing, and remove legacy SQL pathways.
4. **Progressive rollout** – Flip `USE_PARTITIONED_TABLES` for a pilot org, monitor, then expand.
5. **Performance validation** – Run the 1M-tenant load tests, adjust indexes, and set alert thresholds.
6. **Production enablement** – Once metrics remain within SLOs, schedule the final cutover and retire legacy tables.

### Partition Switchover Implementation Plan

1. **Preparation & Script Updates**
   - Update `sync_revenues_insert` and `sync_expenses_insert` triggers to use `ON CONFLICT` upserts so updates cannot duplicate partition rows.
   - Ensure the switchover script (`database/switchover_to_partitioned.sh`) runs idempotently and records before/after counts per table.
2. **Backfill & Validation Dry-Run**
   - In staging, execute the script to backfill `daily_cash_balances_partitioned`, `revenues_partitioned`, and `expenses_partitioned`.
   - Compare row counts and sample checksums between legacy and partitioned tables; halt if discrepancies are detected.
   - Enable dual-write triggers and run high-volume smoke tests while capturing metrics.
3. **Repository Refactor**
   - Introduce a partition-aware repository module (finance/reporting) that wraps all CRUD operations and calls `partitioningManager.routeQuery`.
   - Migrate finance and reports services to the repository, eliminating raw SQL strings that hardcode legacy table names.
   - Add integration tests verifying that CRUD operations resolve to `_partitioned` tables when the flag is on.
4. **Controlled Flag Rollout**
   - Set `USE_PARTITIONED_TABLES=true` for a pilot organization (feature flag or environment override) and monitor query plans (`EXPLAIN`) plus trigger error logs.
   - Gradually expand to additional cohorts once latency and correctness hold steady; keep legacy tables read-only but accessible for diffing.
5. **Operational Monitoring**
   - During rollout, track trigger failure counts, partition bloat, cache invalidations, and query timing dashboards.
   - Establish alert thresholds for partition maintenance cron jobs (missing monthly partition, cleanup lag) and replica lag once enabled.
6. **Final Cutover & Cleanup**
   - After all orgs run on partitions, archive legacy tables (rename to `_legacy`) or convert to views to prevent writes.
   - Document the rollback procedure, including how to disable the flag and replay dual-write verification if issues arise.

## Encore Framework Alignment Checklist

| Capability | Current State | Required Action |
| --- | --- | --- |
| **Bounded Contexts (Encore Core)** | Services (`finance`, `reports`, `cache`, `events`) exist but still share the monolithic `hospitality` tables for core finance data. | Complete the repository refactor so each service routes through partition-aware helpers and respects its own database (`finance`, `event_store`, `read_models`) for derived data. |
| **API & Auth Patterns (encore-api-patterns.mdc)** | Endpoints (e.g., `finance_service.ts`, `reports_service.ts`) follow Encore conventions but contain inline SQL with direct table names. | Introduce repository methods that enforce validation, permissions, and partition routing; update endpoints to consume repository responses rather than embedding SQL. |
| **Database Layer (encore-database.mdc)** | Partitioned schema exists, but there is no repository abstraction or transaction guardrails for partitioned inserts/reads. | Implement repositories with type-safe query wrappers, `ON CONFLICT` upserts, and migration scripts kept idempotent; add regression tests that run `EXPLAIN` to confirm pruning. |
| **Eventing & CQRS (encore-events.mdc)** | Pub/Sub topics (`finance-events`) and durable event store (`event_store` DB) exist, yet Phase 3 in-memory event sourcing is still referenced. | Retire the in-memory `phase3_event_sourcing.ts`, standardize on the Postgres-backed store, and ensure read models are hydrated via subscriptions (reports service already subscribes). |
| **Resilience (encore-resilience.mdc)** | Circuit breaker, retry, and monitoring utilities are implemented but not wired into finance/reports service calls. | Wrap external integrations and DB bulk operations in the provided resilience helpers; publish metrics to Encore dashboards during partition rollout. |
| **Caching Strategy** | Async cache invalidator and distributed cache manager run in-process using a Map. | Deploy Redis/KeyDB per plan, switch cache providers, and surface cache hit/miss metrics via Encore monitoring. |
| **Infrastructure as Code** | Encore dashboard shows all migrations applied; flags remain unset. | Promote environment configs (`USE_PARTITIONED_TABLES`, Redis DSNs, replica DSNs) through Encore deployment manifests once staging validation is complete. |

## Implementation Tasks Snapshot

1. **Partition Readiness**
   - [ ] Patch triggers for `revenues` and `expenses` with `ON CONFLICT` upserts.
   - [ ] Re-run `switchover_to_partitioned.sh` in staging; capture row counts and checksums.
   - [ ] Enable dual-write triggers and monitor for discrepancies.

2. **Repository Refactor**
   - [ ] Create partition-aware repositories for balances, revenues, and expenses.
   - [ ] Update finance/reports endpoints to call repositories and remove inline SQL.
   - [ ] Add integration tests that toggle `USE_PARTITIONED_TABLES` and verify `_partitioned` tables are queried.

3. **Infrastructure Bring-Up**
   - [ ] Provision Redis cluster and update `distributed_cache_manager` to use it.
   - [ ] Configure read replicas and restore the `replicaManager` initialization loop with health checks.
   - [ ] Add PgBouncer and connection pool monitoring to Encore deployment configs.

4. **Controlled Rollout**
   - [ ] Flip `USE_PARTITIONED_TABLES` for pilot org(s) via feature flag.
   - [ ] Review `EXPLAIN` plans, trigger logs, cache metrics, and replica lag dashboards.
   - [ ] Expand rollout once KPI targets hold; archive legacy tables after full adoption.

5. **Resilience & Observability**
   - [ ] Wire circuit breaker/retry utilities into service gateways.
   - [ ] Emit Encore metrics for partition maintenance, cache invalidations, and event processing throughput.
   - [ ] Finalize runbooks and rollback procedures; share with ops team.

## Risks & Mitigations

- **Data divergence during migration** – Mitigate with dual-write verification jobs and row-count diffs per partition.
- **Replica lag/regression** – Implement health checks and automatic failback to primary when lag exceeds thresholds.
- **Cache stampede with new infra** – Keep the async invalidator’s defensive invalidation feature on until Redis performance is proven.
- **Operational complexity** – Deliver training and runbooks for the ops team before enabling all feature flags.

## Next Actions

1. Schedule the staging switchover dry run.
2. Stand up Redis and read replicas; update environment variables and deployment manifests.
3. Begin refactoring services to use partition-aware repositories and reroute through `PartitioningManager`.
4. Plan the 1M-org load test suite re-run with observability instrumentation enabled.


