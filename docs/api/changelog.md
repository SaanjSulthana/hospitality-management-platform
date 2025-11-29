# API Changelog

This changelog documents breaking and notable changes per API version. Versioned base: `/v1` on `api.<domain>`.

## v1.0 (Introduced)
- Introduced versioned base path `/v1/...` for all public endpoints.
- Legacy paths remain temporarily available behind `ENABLE_LEGACY_ROUTES=true` with Deprecation/Sunset headers.
- Realtime endpoints standardized under `/v1/.../realtime/subscribe` with `schemaVersion: 1` in payloads.
- Detailed health moved to `/v1/system/health` (bare `/health` reserved for infra liveness).
- No changes to error codes or rate-limit semantics from pre-v1 behavior.

### Migration Window
- Phase A (proxy + headers): 2–4 weeks from v1 launch.
- Phase B (308 redirects): following 2–4 weeks.
- Removal of legacy paths: target 60–90 days from v1 launch (publish exact dates below).

### Important Dates (staging rollout)
- v1 launch date: 2025-12-01 (Day 0)
- Start proxy (legacy → v1): 2025-12-01
- Switch legacy to 308: 2025-12-15 (+2 weeks)
- Legacy removal: 2026-02-14 (+~60 days)

### Example Proposed Schedule (adjust per org needs)
- v1 launch date: 2025-12-01
- Start proxy (legacy → v1): 2025-12-01
- Switch legacy to 308: 2025-12-15
- Legacy removal: 2026-02-14

### Developer Notes
- Encore endpoints must declare `path` values starting with `/v`.
- Additions to realtime payloads must be backward compatible under `schemaVersion: 1`. Breaking payload changes require `/v2`.

---

## v1.1 (Preview — optional)
- Reserved for preview features gated via `X-API-Version: 1.1`. No public changes announced.


