# CORS Configuration Guide

## Overview

This document explains the CORS (Cross-Origin Resource Sharing) configuration for the Hospitality Management Platform backend API.

## Current Configuration

The CORS configuration is defined in `backend/encore.app` under the `global_cors` section.

### Production Origins

- `https://curat.ai` - Production frontend domain
- `https://www.curat.ai` - Production frontend domain (www subdomain)

### Development Origins

- `http://localhost:5173` - Vite development server
- `http://localhost:3000` - Alternative development server

## Important Limitations

### ⚠️ Encore Does NOT Support Wildcard Patterns

**Encore's CORS configuration only supports exact origin matching.** Wildcard patterns like `https://*.netlify.app` are **NOT supported** and will be treated as literal strings, causing CORS failures.

### Impact on Netlify Preview Deployments

Netlify preview deployments (e.g., `https://deploy-preview-123--hospitalitymanagementplatform.netlify.app`) will **NOT work** with authenticated requests because:

1. Encore requires exact origin matches
2. Netlify preview URLs are dynamic and unpredictable
3. We cannot add every possible preview URL to the CORS allowlist

### Solutions for Netlify Preview Deployments

#### Option 1: Use Production Domain (Recommended)
- Configure Netlify to use your custom domain `curat.ai` for all deployments
- This ensures all deployments use the same origin and CORS works correctly

#### Option 2: Accept Limitation for Previews
- Preview deployments can still work for **unauthenticated** requests if you add them to `allow_origins_without_credentials`
- However, authenticated requests (with cookies/auth headers) will fail
- This is acceptable for preview/testing purposes

#### Option 3: Manual Addition (Not Recommended)
- Manually add specific preview URLs to the CORS config as needed
- This is not practical due to the dynamic nature of preview URLs

## Configuration Structure

```json
{
  "global_cors": {
    "debug": false,
    "allow_origins_without_credentials": [
      // Origins allowed for requests WITHOUT credentials (cookies, auth headers)
      "https://curat.ai",
      "https://www.curat.ai",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "allow_origins_with_credentials": [
      // Origins allowed for requests WITH credentials (cookies, auth headers)
      // Must be exact matches - NO wildcards supported
      "https://curat.ai",
      "https://www.curat.ai",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "allow_headers": [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Idempotency-Key",
      "If-None-Match",
      "If-Modified-Since"
    ],
    "expose_headers": [
      "Content-Length",
      "ETag",
      "Last-Modified",
      "Cache-Control",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Retry-After",
      "Idempotent-Replayed",
      "X-Fields-Returned",
      "X-Fields-Available"
    ],
    "max_age_seconds": 7200
  }
}
```

## Adding New Origins

To add a new origin:

1. **Determine if credentials are used:**
   - If requests include cookies or Authorization headers → add to `allow_origins_with_credentials`
   - If requests don't include credentials → add to `allow_origins_without_credentials`
   - If unsure, add to both lists

2. **Use exact origin format:**
   - ✅ Correct: `"https://example.com"`
   - ✅ Correct: `"https://www.example.com"`
   - ❌ Wrong: `"https://*.example.com"` (wildcards not supported)
   - ❌ Wrong: `"https://example.com/*"` (path not part of origin)

3. **Update `backend/encore.app`** and redeploy the backend

## Testing CORS Configuration

### Test from Browser Console

```javascript
// Test without credentials
fetch('https://api.curat.ai/v1/auth/health', {
  method: 'GET',
  credentials: 'omit'
})
.then(r => console.log('CORS OK (no credentials):', r.status))
.catch(e => console.error('CORS Error:', e));

// Test with credentials
fetch('https://api.curat.ai/v1/auth/health', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(r => console.log('CORS OK (with credentials):', r.status))
.catch(e => console.error('CORS Error:', e));
```

### Check Response Headers

Look for these headers in the response:
- `Access-Control-Allow-Origin`: Should match your frontend origin exactly
- `Access-Control-Allow-Credentials`: Should be `true` if credentials are allowed
- `Access-Control-Allow-Headers`: Should include headers you're sending

## Troubleshooting

### CORS Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** Origin not in allowlist or exact match failed

**Solution:**
1. Verify the origin is exactly as it appears in the browser (including protocol, domain, port)
2. Check if it's in the correct list (`with_credentials` vs `without_credentials`)
3. Ensure no typos or extra characters

### CORS Error: "Credentials flag is true, but 'Access-Control-Allow-Credentials' is not"

**Cause:** Origin is in `allow_origins_without_credentials` but request includes credentials

**Solution:**
1. Move origin to `allow_origins_with_credentials` list
2. Or remove credentials from the request (if not needed)

### Preview Deployments Not Working

**Cause:** Netlify preview URLs are dynamic and not in CORS allowlist

**Solution:**
1. Use custom domain for all deployments (recommended)
2. Accept limitation for preview deployments
3. Test authenticated features on production domain only

## References

- [Encore CORS Documentation](https://encore.dev/docs/go/develop/cors)
- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

