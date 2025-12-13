# CDN Setup Guide — 10M Organization Scale

Last updated: 2025-12-13  
Part of: Phase 1 Foundation (Tasks 2.6-2.9)  
Status: Implementation Complete, Awaiting Production Configuration

---

## Overview

This guide covers CDN setup for the Hospitality Management Platform to support 10M organizations. The implementation includes:

- ✅ Org-scoped cache keys ([`backend/middleware/cache_headers.ts`](backend/middleware/cache_headers.ts))
- ✅ Surrogate-key tagging ([`backend/cache/cdn_invalidation.ts`](backend/cache/cdn_invalidation.ts))
- ⏳ CDN provider configuration (Cloudflare/CloudFront)
- ⏳ Purge-by-tag testing

---

## Supported CDN Providers

### 1. Cloudflare (Recommended)

**Pros:**
- Native surrogate-key support (called "Cache Tags")
- Excellent global coverage
- Built-in WAF and DDoS protection
- Generous free tier
- Easy API integration

**Cons:**
- Requires Business plan ($200/month) for Cache Tags
- 35 tags per request limit

**Setup:**
```bash
# Environment variables
CDN_PROVIDER=cloudflare
CDN_API_KEY=your_cloudflare_api_token
CDN_ZONE_ID=your_zone_id
```

### 2. AWS CloudFront

**Pros:**
- Deep AWS integration
- Pay-as-you-go pricing
- Global edge network

**Cons:**
- No native surrogate-key support
- Requires path-based invalidation (slower)
- More complex setup

**Setup:**
```bash
# Environment variables
CDN_PROVIDER=cloudfront
CDN_API_KEY=your_aws_access_key
CDN_DISTRIBUTION_ID=your_distribution_id
```

### 3. Fastly

**Pros:**
- Best-in-class surrogate-key purging
- Real-time analytics
- Instant purge (< 150ms globally)

**Cons:**
- More expensive
- Smaller free tier

**Setup:**
```bash
# Environment variables
CDN_PROVIDER=fastly
CDN_API_KEY=your_fastly_api_key
CDN_ZONE_ID=your_service_id
```

---

## Implementation Details

### Cache Headers Middleware

Location: [`backend/middleware/cache_headers.ts`](backend/middleware/cache_headers.ts)

**Features:**
- Org-scoped cache key generation
- Property-scoped cache keys
- User-scoped cache keys
- ETag generation and validation
- Cache-Control header generation
- Surrogate-Key tagging

**Usage Example:**
```typescript
import { 
    generateCacheMetadata, 
    generatePropertyCacheKeys,
    CachePresets 
} from '../middleware/cache_headers';

export const getProperty = api(
    { expose: true, method: "GET", path: "/v1/properties/:id" },
    async ({ id }): Promise<PropertyResponse> => {
        const property = await getPropertyById(id);
        
        // Generate cache metadata with surrogate keys
        const cacheMeta = generateCacheMetadata({
            ...CachePresets.LONG, // 1 hour cache
            surrogateKeys: generatePropertyCacheKeys(
                property.orgId, 
                property.id
            ),
        });
        
        return {
            ...property,
            _meta: cacheMeta
        };
    }
);
```

### CDN Invalidation Service

Location: [`backend/cache/cdn_invalidation.ts`](backend/cache/cdn_invalidation.ts)

**API Endpoints:**

1. **Purge by Keys**
   ```bash
   POST /v1/cache/purge
   {
     "keys": ["org:123", "property:456"]
   }
   ```

2. **Purge Organization Cache**
   ```bash
   POST /v1/cache/purge/org/123
   ```

3. **Purge Property Cache**
   ```bash
   POST /v1/cache/purge/property/456
   ```

4. **Get CDN Status**
   ```bash
   GET /v1/cache/cdn/status
   ```

**Programmatic Usage:**
```typescript
import { 
    purgeOrgCache, 
    purgePropertyCache,
    purgeFinanceCache 
} from '../cache/cdn_invalidation';

// After updating property
await purgePropertyCache(orgId, propertyId);

// After finance transaction
await purgeFinanceCache(orgId, propertyId);
```

---

## Cache Key Strategy

### Hierarchical Keys

```
org:123                          # All org data
├── property:456                 # Specific property
│   ├── org:123:property:456    # Org+Property combo
│   ├── finance                  # Finance data
│   └── reports                  # Reports
└── user:789                     # User data
    └── org:123:user:789        # Org+User combo
```

### Key Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| `org:{orgId}` | `org:123` | Purge all org data |
| `property:{propertyId}` | `property:456` | Purge property data |
| `user:{userId}` | `user:789` | Purge user data |
| `org:{orgId}:property:{propertyId}` | `org:123:property:456` | Specific org+property |
| `org:{orgId}:finance` | `org:123:finance` | Org finance data |
| `property:{propertyId}:finance` | `property:456:finance` | Property finance |

---

## Cloudflare Setup (Step-by-Step)

### 1. Create Cloudflare Account

1. Sign up at https://cloudflare.com
2. Add your domain
3. Update nameservers at your registrar
4. Wait for DNS propagation (usually < 1 hour)

### 2. Upgrade to Business Plan

Cache Tags require Business plan ($200/month):
1. Go to Billing → Plans
2. Upgrade to Business
3. Enable "Cache Tags" feature

### 3. Generate API Token

1. Go to My Profile → API Tokens
2. Create Token → Custom Token
3. Permissions:
   - Zone → Cache Purge → Purge
   - Zone → Zone → Read
4. Zone Resources:
   - Include → Specific zone → yourdomain.com
5. Copy the token (shown only once!)

### 4. Get Zone ID

1. Go to your domain overview
2. Scroll to API section (right sidebar)
3. Copy Zone ID

### 5. Configure Environment

```bash
# .env or production secrets
CDN_PROVIDER=cloudflare
CDN_API_KEY=your_api_token_here
CDN_ZONE_ID=your_zone_id_here
```

### 6. Configure Cache Rules

In Cloudflare dashboard:

**Page Rule 1: Cache API Responses**
```
URL: api.yourdomain.com/v1/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: Respect Existing Headers
  - Browser Cache TTL: Respect Existing Headers
```

**Page Rule 2: Bypass Cache for Writes**
```
URL: api.yourdomain.com/v1/*/POST
Settings:
  - Cache Level: Bypass
```

### 7. Test Configuration

```bash
# Check CDN status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/v1/cache/cdn/status

# Test purge
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keys":["org:1"]}' \
  http://localhost:4000/v1/cache/purge
```

---

## CloudFront Setup (Alternative)

### 1. Create Distribution

```bash
aws cloudfront create-distribution \
  --origin-domain-name api.yourdomain.com \
  --default-root-object index.html
```

### 2. Configure Behaviors

- **Default Behavior:**
  - Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
  - Cache Policy: CachingOptimized
  - Origin Request Policy: AllViewer

- **API Behavior (/v1/*):**
  - Cache Based on: Headers (Authorization, If-None-Match)
  - TTL: Respect Cache-Control headers

### 3. Set Environment Variables

```bash
CDN_PROVIDER=cloudfront
CDN_API_KEY=your_aws_access_key_id
CDN_DISTRIBUTION_ID=your_distribution_id
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

**Note:** CloudFront doesn't support surrogate-key purging. The implementation falls back to path-based invalidation.

---

## Cache Presets

Defined in [`backend/middleware/cache_headers.ts`](backend/middleware/cache_headers.ts):

| Preset | Max-Age | Stale-While-Revalidate | Use Case |
|--------|---------|------------------------|----------|
| `SHORT` | 60s | 5min | Frequently changing data |
| `MEDIUM` | 5min | 15min | Moderately stable data |
| `LONG` | 1hour | 6hours | Stable data |
| `PUBLIC` | 1day | 7days | Static/public assets |
| `NO_CACHE` | 0s | 0s | Sensitive/realtime data |

**Usage:**
```typescript
import { CachePresets } from '../middleware/cache_headers';

// Use preset
const cacheMeta = generateCacheMetadata({
    ...CachePresets.MEDIUM,
    surrogateKeys: ['org:123'],
});
```

---

## Testing Purge-by-Tag

### Manual Testing

```bash
# 1. Make a request and note the response
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/v1/properties

# 2. Check Surrogate-Key header in response _meta
# Should see: "org:123 properties"

# 3. Purge the cache
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keys":["org:123"]}' \
  http://localhost:4000/v1/cache/purge

# 4. Verify purge succeeded
# Response should show: {"success":true,"purgedKeys":["org:123"],...}

# 5. Make the same request again
# Should get fresh data (not cached)
```

### Automated Testing

Create test script: `test-cdn-purge.sh`

```bash
#!/bin/bash

TOKEN="your_test_token"
BASE_URL="http://localhost:4000"

echo "=== CDN Purge Test ==="

# Test 1: Check CDN status
echo "\n1. Checking CDN status..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/cache/cdn/status" | jq

# Test 2: Purge org cache
echo "\n2. Purging org:1 cache..."
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keys":["org:1"]}' \
  "$BASE_URL/v1/cache/purge" | jq

# Test 3: Purge property cache
echo "\n3. Purging property:1 cache..."
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/cache/purge/property/1" | jq

# Test 4: Verify cache headers in response
echo "\n4. Checking cache headers..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/v1/properties" | jq '._meta'

echo "\n=== Test Complete ==="
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **CDN Hit Rate** | >80% | Authenticated GETs |
| **Cache Purge Latency** | <5s | Global propagation |
| **Origin Offload** | >70% | Requests served from CDN |
| **TTFB (Cached)** | <50ms | p95 |
| **TTFB (Origin)** | <300ms | p95 |

---

## Cost Estimates

### Cloudflare Business

- Base: $200/month
- Bandwidth: Unlimited
- Requests: Unlimited
- Cache Purge: Unlimited
- **Total: ~$200/month**

### AWS CloudFront

- Bandwidth: $0.085/GB (first 10TB)
- Requests: $0.0075/10K requests
- Invalidations: $0.005 per path
- **Estimated: $500-1500/month at 10M scale**

### Fastly

- Bandwidth: $0.12/GB
- Requests: $0.0075/10K requests
- Instant Purge: Included
- **Estimated: $800-2000/month at 10M scale**

**Recommendation:** Start with Cloudflare Business for best value and features.

---

## Integration Checklist

- [x] Cache headers middleware implemented
- [x] Surrogate-key generation functions
- [x] CDN invalidation service
- [x] Purge API endpoints
- [x] Cache presets defined
- [ ] CDN provider configured (production)
- [ ] DNS updated to CDN
- [ ] SSL certificates configured
- [ ] Cache rules configured
- [ ] Purge-by-tag tested
- [ ] Monitoring dashboards updated
- [ ] Load testing with CDN

---

## Monitoring

### Key Metrics to Track

1. **Cache Hit Rate**
   - Target: >80%
   - Alert if <70%

2. **Origin Request Rate**
   - Should decrease after CDN deployment
   - Target: <30% of total requests

3. **Purge Success Rate**
   - Target: 100%
   - Alert on failures

4. **Cache Latency**
   - p50: <20ms
   - p95: <50ms
   - p99: <100ms

### Grafana Dashboard Queries

```promql
# Cache hit rate
sum(rate(cdn_hits_total[5m])) / sum(rate(cdn_requests_total[5m]))

# Origin offload percentage
100 * (1 - sum(rate(origin_requests_total[5m])) / sum(rate(cdn_requests_total[5m])))

# Purge success rate
sum(rate(cdn_purge_success_total[5m])) / sum(rate(cdn_purge_attempts_total[5m]))
```

---

## Troubleshooting

### Issue: Cache not working

**Check:**
1. CDN_PROVIDER environment variable set?
2. API key valid?
3. Zone ID correct?
4. Cache-Control headers in response?
5. Surrogate-Key headers present?

**Debug:**
```bash
# Check response headers
curl -I -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/v1/properties

# Should see:
# Cache-Control: private, max-age=300, stale-while-revalidate=900
# Surrogate-Key: org:123 properties
```

### Issue: Purge not working

**Check:**
1. API token has purge permissions?
2. Correct surrogate keys used?
3. CDN provider supports surrogate-key purging?

**Debug:**
```bash
# Enable debug logging
DEBUG=cdn:* npm start

# Check purge response
curl -v -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keys":["org:1"]}' \
  http://localhost:4000/v1/cache/purge
```

### Issue: High cache miss rate

**Possible causes:**
1. Cache TTL too short
2. Too many unique cache keys
3. Frequent purges
4. Vary headers too broad

**Solutions:**
1. Increase TTL for stable data
2. Consolidate cache keys
3. Batch purges
4. Minimize Vary headers

---

## Next Steps

1. **Choose CDN Provider** (Cloudflare recommended)
2. **Configure Production Environment**
   - Set environment variables
   - Update DNS
   - Configure SSL
3. **Test Purge-by-Tag** (Task 2.9)
4. **Set Up Monitoring** (Task 2.11)
5. **Load Test** (Task 2.13)

---

## References

- Cache headers: [`backend/middleware/cache_headers.ts`](backend/middleware/cache_headers.ts)
- CDN invalidation: [`backend/cache/cdn_invalidation.ts`](backend/cache/cdn_invalidation.ts)
- 10M Scale Plan: [`.kilocode/rules/memory-bank/10M-ORG-SCALE-PLAN.md`](.kilocode/rules/memory-bank/10M-ORG-SCALE-PLAN.md)
- Implementation TODOs: [`10M-SCALE-IMPLEMENTATION-TODOS.md`](10M-SCALE-IMPLEMENTATION-TODOS.md)

---

**Status:** Tasks 2.7 & 2.8 Complete ✅  
**Next:** Task 2.6 (CDN Configuration) & Task 2.9 (Testing)
