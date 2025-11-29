# 🔍 Documents API Versioning - Audit Report

## 📊 Summary

| Category | Count |
| --- | --- |
| Total User-Facing Endpoints | 6 |
| Already Versioned | 0 |
| Need Versioning | 6 |
| System/Worker Endpoints | 2 (excluded) |

### Scope
- **User-facing (auth required):**
  1. `create_export.ts` – `POST /documents/exports/create`
  2. `list_exports.ts` – `GET /documents/exports`
  3. `get_export_status.ts` – `GET /documents/exports/:exportId/status`
  4. `download_export.ts` – `GET /documents/exports/:exportId/download`
  5. `retry_export.ts` – `POST /documents/exports/:exportId/retry`
  6. `delete_export.ts` – `DELETE /documents/exports/:exportId`
- **Infrastructure/cron (excluded):**
  - `cleanup_cron.ts` – `POST /documents/cleanup` (not exposed)
  - `process_export.ts` – `POST /documents/exports/:exportId/process` (not exposed)

All 6 user-facing endpoints require shared handlers + `/v1` routes while keeping legacy paths for backward compatibility.

---

## ✅ Plan of Action

1. Add shared handler functions for each user endpoint.
2. Keep existing legacy routes (`/documents/...`).
3. Add `/v1/documents/...` routes pointing to the shared handlers.
4. Update `frontend/src/utils/api-standardizer.ts` with new V1 paths.
5. Run lints and document completion.

---

## 🧭 Notes

- All endpoints require auth and role checks (`ADMIN`/`MANAGER`).
- Downloads return binary (base64) responses; ensure handlers reused.
- Cron/process endpoints remain untouched (internal use).

---

**Ready to implement versioning for all 6 endpoints.**

Generated: November 25, 2025

