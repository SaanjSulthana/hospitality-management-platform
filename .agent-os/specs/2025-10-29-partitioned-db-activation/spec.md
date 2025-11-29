# Spec Requirements Document

> Spec: Partitioned Database Activation & Observability Rollout
> Created: 2025-10-29

## Overview

Enable the partitioned Postgres schema, supporting repositories, and observability required to safely run the hospitality platform at 1M-organization scale while preserving rollback paths.

## User Stories

### Ops Engineer: Confident Cutover

As an operations engineer, I want the partition cutover to be fully scripted and observable so that I can enable or disable partition routing without risking data loss.

### Backend Developer: Single Access Layer

As a backend developer, I want repository helpers that hide partition mechanics so that I can build new finance and reporting features without touching raw table names.

### SRE: Real-Time Visibility

As an SRE, I want metrics and alerts on partitions, caches, and replicas so that I can detect regressions immediately after rollout.

## Spec Scope

1. **Trigger Hardening & Migration Automation** – Update revenue/expense triggers to use `ON CONFLICT` upserts, rehearse the switchover script in staging, and document verification steps.
2. **Partition-Aware Repository Layer** – Introduce shared repository modules for finance and reporting services with partition routing, integration tests, and feature flags.
3. **Infrastructure Bring-Up** – Provision Redis and read replicas, reinstate the replica manager initialization, and wire PgBouncer/connection pooling configs.
4. **Observability & Rollout Tooling** – Instrument metrics, hook cron jobs, and define pilot rollout + rollback procedures for enabling `USE_PARTITIONED_TABLES`.

## Out of Scope

- UI/UX changes in the frontend dashboards.
- New product features unrelated to database scalability (e.g., additional finance workflows).
- Multi-region sharding beyond current single-cluster partitioning.

## Expected Deliverable

1. Verified partition cutover playbook with dual-write validation, metrics dashboards, and documented rollback.
2. Updated services and infrastructure configs running successfully with `USE_PARTITIONED_TABLES=true` in staging and ready for phased production rollout.

