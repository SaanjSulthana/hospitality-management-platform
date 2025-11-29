# API Versioning: Runtime Flags, CI, and Usage

## Runtime Flags (Express legacy routing)
- ENABLE_LEGACY_ROUTES
  - Type: boolean (string), default: "true"
  - Behavior: when true, legacy non-/v1 paths are served with deprecation headers. When false, legacy paths return 410 Gone.
- LEGACY_REDIRECT_308
  - Type: boolean (string), default: "false"
  - Behavior: when true, legacy non-/v1 paths issue HTTP 308 redirects to the equivalent `/v1` path.
- LEGACY_SUNSET_AT
  - Type: RFC1123 datetime string
  - Default: Wed, 01 Feb 2026 00:00:00 GMT
  - Behavior: value for `Sunset` header on legacy paths.

These are wired in `backend/server.cjs`. Recommended rollout:
1) ENABLE_LEGACY_ROUTES=true, LEGACY_REDIRECT_308=false (proxy/headers)
2) ENABLE_LEGACY_ROUTES=true, LEGACY_REDIRECT_308=true (redirect)
3) ENABLE_LEGACY_ROUTES=false (remove legacy)

## Encore Path Helper
- `backend/shared/http.ts`:
  - `export const API_V1_PREFIX = "/v1";`
  - `export function v1Path(resourcePath: string): string;`
  - Use in Encore endpoints: `path: v1Path("/finance/revenues")`

## CI Guardrail
- Script: `scripts/check-versioned-paths.sh`
- Package script: `npm run ci:check-versioned-paths`
- Purpose: fails if any Encore `api({ path })` doesn’t start with `/v`.

## OpenAPI Generation
Generate and store a v1 spec:
```
encore gen openapi > docs/api/v1/openapi.yaml
```

## Frontend
- `frontend/src/utils/api-standardizer.ts` prefixes all endpoints with `/v1`.
- To fall back temporarily, change the versioned strings or wire a base URL prefix.


