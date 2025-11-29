# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-29-partitioned-db-activation/spec.md

## Technical Requirements

- **Trigger & Migration Hardening**
  - Update `sync_revenues_insert` and `sync_expenses_insert` PL/pgSQL functions to use `ON CONFLICT` upserts and timestamp updates.
  - Extend `switchover_to_partitioned.sh` to emit row counts and checksums before/after migration steps.
  - Provide an Encore job or script to run dual-write verification (legacy vs. partition counts) post-cutover.

- **Partition-Aware Repository Layer**
  - Create shared repository modules (e.g., `backend/finance/repository.ts`, `backend/reports/repository.ts`) that encapsulate CRUD operations for balances, revenues, and expenses.
  - Route all repository methods through `partitioningManager.routeQuery` and accept a feature-flag override for pilot orgs.
  - Replace inline SQL in finance/report services with repository calls; add Jest integration tests toggling `USE_PARTITIONED_TABLES` to verify partition usage.

- **Infrastructure Integration**
  - Provision Redis/KeyDB connection settings; update `distributed_cache_manager` and `redis_cache_service` to use Encore’s cache providers instead of in-memory maps.
  - Re-enable the read replica initialization loop in `database/replica_manager.ts`, sourcing DSNs from environment variables and handling `replicaCount === 0` gracefully.
  - Configure PgBouncer/connection pooling thresholds in Encore deployment files (max connections, timeouts) for both primary and replicas.

- **Observability & Rollout Tooling**
  - Emit metrics via Encore monitoring for partition maintenance cron jobs, cache invalidations, and replica health.
  - Add structured logging for partition routing decisions and trigger failures.
  - Document pilot rollout steps (feature-flag enable, monitoring checklist, rollback command) and store under `.agent-os/recaps/` or `docs/`.

## External Dependencies (Conditional)

- **Redis/KeyDB Cluster** – Required to replace the current in-memory cache implementation.
  - *Justification:* Enables horizontal scaling, persistence, and accurate cache invalidation metrics.
  - *Version:* Managed service or Redis >= 6.0 with TLS support.

- **PgBouncer (transaction mode)** – Fronts primary and read replicas to control connection spikes post-cutover.
  - *Justification:* Maintains stable connection pools when multiple services route through partition-aware repositories.

