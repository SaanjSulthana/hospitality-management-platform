# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-10-29-partitioned-db-activation/spec.md

## Planned Changes

1. **Trigger Upserts**
   - Modify `sync_revenues_insert` to perform `INSERT ... ON CONFLICT (org_id, property_id, occurred_at)` with updates to amount, status, metadata fields, and timestamps.
   - Modify `sync_expenses_insert` similarly with the appropriate unique key.
   - Ensure `daily_cash_balances` trigger maintains uniqueness on `(org_id, property_id, balance_date)` and updates audit fields.

2. **Switchover Script Enhancements**
   - Extend `database/switchover_to_partitioned.sh` to capture and log row counts, checksums, and timing for each table before and after backfill.
   - Add optional verification flags (e.g., `--verify-only`) and a summary exit status for automation.

3. **Verification Queries**
   - Provide SQL snippets for parity checks:
     ```sql
     SELECT COUNT(*) FROM revenues;
     SELECT COUNT(*) FROM revenues_partitioned;

     SELECT SUM(amount_cents) FROM revenues WHERE occurred_at >= $1 AND occurred_at < $2;
     SELECT SUM(amount_cents) FROM revenues_partitioned WHERE occurred_at >= $1 AND occurred_at < $2;
     ```
   - Create optional materialized views or temp tables for checksum comparisons if datasets are large.

## Migration / Deployment Notes

- Use idempotent `ALTER FUNCTION ...` statements to update triggers so re-running migrations is safe.
- Run switchover script in staging with realistic load before production cutover; store logs for audit.
- After final cutover, consider converting legacy tables to views or renaming (`*_legacy`) once verification completes.

