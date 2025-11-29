# Spec Tasks

- [x] 1. Harden partition triggers and switchover automation
  - [x] 1.1 Write tests or verification queries for trigger upserts and dual-write parity
  - [x] 1.2 Update PL/pgSQL triggers with `ON CONFLICT` logic and regenerate migration scripts
  - [x] 1.3 Extend `switchover_to_partitioned.sh` with row-count logging and dry-run flag
  - [x] 1.4 Execute staging rehearsal and verify legacy vs partition counts
  - [x] 1.5 Verify all tests/validation scripts pass

- [x] 2. Build partition-aware repositories and update services
  - [x] 2.1 Write integration tests toggling `USE_PARTITIONED_TABLES` to confirm `_partitioned` access
  - [x] 2.2 Implement shared repository modules for finance/report services with partition routing
  - [x] 2.3 Replace inline SQL in services with repository calls and feature-flag pilot org routing
  - [x] 2.4 Ensure all service tests pass in both partitioned and legacy modes

- [x] 3. Deploy infrastructure and observability enhancements
  - [x] 3.1 Provision Redis and update cache manager to use external store
  - [x] 3.2 Restore replica manager initialization with health checks and PgBouncer configs
  - [x] 3.3 Add Encore metrics/alerts for partitions, cache invalidations, and replica lag
  - [x] 3.4 Document rollout/rollback handbook and confirm monitoring dashboards are live
  - [x] 3.5 Verify all smoke tests and observability checks pass post-deployment

