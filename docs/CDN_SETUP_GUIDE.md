# CDN Setup Guide

This guide covers CDN configuration for the hospitality management platform to achieve the networking optimization targets defined in the P0 plan.

## Recommended CDN: Cloudflare

For your scale (targeting 10M users), **Cloudflare** offers the best balance of features, pricing, and ease of setup. Alternative options include AWS CloudFront and Fastly.

### Why Cloudflare?

- **Global edge network**: 300+ locations worldwide
- **HTTP/2 and HTTP/3 support**: Out of the box
- **Purge-by-tag**: Via Surrogate-Key headers (Enterprise) or Cache Tags API
- **Edge Rules**: Cache key customization without code changes
- **Worker integration**: For advanced tenant isolation
- **Cost effective**: Free tier for development, predictable pricing at scale

---

## Configuration Steps

### 1. DNS and SSL Setup

```
1. Add your domain to Cloudflare
2. Update nameservers at your registrar
3. Enable "Full (strict)" SSL mode
4. Enable "Always Use HTTPS"
```

### 2. Cache Configuration

#### Page Rules (Basic)

Create page rules for cacheable endpoints:

```
URL Pattern: *yourdomain.com/v1/reports/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 15 minutes
  - Browser Cache TTL: 5 minutes

URL Pattern: *yourdomain.com/v1/properties*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 30 minutes
  - Browser Cache TTL: 5 minutes

URL Pattern: *yourdomain.com/v1/branding/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 30 minutes
  - Browser Cache TTL: 10 minutes
```

#### Cache Rules (Advanced - Enterprise)

For multi-tenant cache isolation:

```javascript
// Cache Rule: Include tenant key in cache key
Match: hostname equals "api.yourdomain.com"
Then:
  - Cache Key: Include header "X-Org-Key"
  - Origin Cache Control: On
```

### 3. Tenant Cache Isolation

**Critical**: Multi-tenant data MUST be isolated in the CDN cache.

#### Option A: Cache Key Header (Recommended)

The backend adds `X-Org-Key` header with hashed tenant ID:

```
X-Org-Key: base32(sha256(orgId))
```

Configure Cloudflare to:
1. Include `X-Org-Key` in cache key
2. **Strip `X-Org-Key` from client responses** (security)

```javascript
// Cloudflare Worker to strip internal headers
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const response = await fetch(request)
  const newHeaders = new Headers(response.headers)
  
  // Strip internal headers before sending to client
  newHeaders.delete('X-Org-Key')
  newHeaders.delete('Surrogate-Key')
  newHeaders.delete('Surrogate-Control')
  
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  })
}
```

#### Option B: URL-based Partitioning

Include tenant ID in URL path (less elegant but simpler):

```
/v1/org/{orgId}/reports/daily-report
```

### 4. Purge-by-Tag Setup

The backend emits `Surrogate-Key` headers for targeted cache invalidation:

```
Surrogate-Key: org:123 property:456 finance:summary:property:456
```

#### Cloudflare API Purge

```bash
# Purge by tag (Enterprise)
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"tags":["finance:summary:property:456"]}'

# Purge by prefix (all plans)
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"prefixes":["https://api.yourdomain.com/v1/finance/"]}'
```

#### Integrate with Backend Events

```typescript
// Example: Purge on finance mutation
import { financeEvents } from '../finance/events';

financeEvents.subscribe('cdn-purge', async (event) => {
  const keys = [
    `finance:summary:property:${event.propertyId}`,
    `org:${event.orgId}`,
  ];
  
  await purgeCloudflareByTags(keys);
});
```

### 5. Origin Shield

Enable origin shielding to reduce origin load:

```
Cloudflare Dashboard > Speed > Optimization > Argo Smart Routing
Enable: Argo Tiered Caching
```

This routes cache misses through a single regional shield before hitting origin.

### 6. Compression

Cloudflare automatically handles Brotli/gzip compression. Ensure:

```
Dashboard > Speed > Optimization
Enable: Brotli
Enable: Auto Minify (for static assets)
```

The backend also compresses responses, but CDN compression is more efficient for cache hits.

### 7. HTTP/2 and HTTP/3

```
Dashboard > Network
Enable: HTTP/2
Enable: HTTP/3 (with QUIC)
```

---

## Cache Header Reference

The backend sends these headers for CDN integration:

### Cache-Control

```
Cache-Control: public, max-age=300, s-maxage=900, stale-while-revalidate=86400, stale-if-error=604800
```

| Directive | Purpose |
|-----------|---------|
| `public` | Cacheable by CDN |
| `max-age` | Browser cache TTL |
| `s-maxage` | CDN cache TTL (overrides max-age) |
| `stale-while-revalidate` | Serve stale while fetching fresh |
| `stale-if-error` | Serve stale if origin errors |

### ETag

```
ETag: "a1b2c3d4e5f67890"
```

Used for conditional GET validation. Clients should send `If-None-Match` header.

### Vary

```
Vary: Accept, Accept-Encoding
```

Tells CDN to cache separate versions for different Accept/Accept-Encoding values.

### Surrogate-Key

```
Surrogate-Key: org:123 property:456 finance:summary:property:456
```

Space-separated tags for targeted purge. CDN-specific feature.

### Surrogate-Control

```
Surrogate-Control: max-age=900
```

CDN-specific caching directive (respected by Fastly, Varnish).

---

## TTL Policies by Endpoint

| Endpoint Family | s-maxage | max-age | Rationale |
|----------------|----------|---------|-----------|
| Properties | 30 min | 5 min | Low churn, purge on change |
| Branding | 30 min | 10 min | Low churn, purge on change |
| Users | 10 min | 2 min | Moderate churn |
| Analytics | 5 min | 1 min | Summary data, realtime invalidates |
| Finance | 5 min | 1 min | Summary data, realtime invalidates |
| Reports | 15 min | 5 min | Historical data, stable |
| Staff | 3 min | 1 min | Operational data |
| Tasks | 2 min | 30 sec | High churn |
| Guest Check-in | 1 min | 15 sec | Very high churn |
| Auth | no-store | no-store | Never cache |
| Realtime | no-store | no-store | Never cache |

---

## Monitoring and Alerting

### Cloudflare Analytics

Monitor these metrics:

- **Cache Hit Ratio**: Target ≥95% for static, ≥80% for dynamic
- **Origin Requests**: Should decrease after CDN setup
- **Bandwidth Saved**: Track cost savings
- **304 Responses**: High ratio indicates good ETag usage

### Backend Metrics

The middleware exposes these endpoints:

```
GET /v1/monitoring/baseline-metrics  # Overall metrics
GET /v1/monitoring/slo-status        # SLO compliance
```

### Alerts

Set up alerts for:

```
- Cache hit ratio < 70% for 5 minutes
- Origin error rate > 1% for 5 minutes
- p95 TTFB > 500ms for 5 minutes
```

---

## Rollout Plan

### Phase 1: Enable CDN (Week 1-2)

1. Configure Cloudflare with basic caching rules
2. Enable for staging environment
3. Verify cache hit ratio and 304 responses
4. Monitor for data isolation issues

### Phase 2: Tenant Isolation (Week 2-3)

1. Deploy X-Org-Key header logic
2. Configure cache key rules
3. Deploy header stripping worker
4. Verify tenant isolation in logs

### Phase 3: Purge Integration (Week 3-4)

1. Implement purge API client
2. Connect to backend event system
3. Test purge latency (<30s target)
4. Monitor purge queue depth

### Phase 4: Optimization (Week 4+)

1. Enable HTTP/3
2. Tune TTLs based on real traffic
3. Enable origin shielding
4. Cost analysis and optimization

---

## Troubleshooting

### Cache Not Working

1. Check `Cache-Control` header in response
2. Verify `Vary` header isn't too broad
3. Check for `Set-Cookie` header (prevents caching)
4. Verify URL pattern matches page rule

### Stale Data After Update

1. Check purge API response
2. Verify Surrogate-Key header is present
3. Check purge latency in logs
4. Manual purge to verify

### Cross-Tenant Data Leak

**CRITICAL**: Immediately:
1. Disable CDN caching (set `Cache-Control: no-store`)
2. Purge all caches
3. Investigate cache key configuration
4. Review X-Org-Key implementation

---

## Alternative: AWS CloudFront

If using AWS infrastructure:

```yaml
# CloudFront Distribution Config
CacheBehaviors:
  - PathPattern: /v1/reports/*
    CachePolicyId: !Ref ReportsCachePolicy
    OriginRequestPolicyId: !Ref StandardOriginPolicy
    
CachePolicies:
  ReportsCachePolicy:
    DefaultTTL: 900  # 15 minutes
    MaxTTL: 86400
    MinTTL: 60
    HeadersConfig:
      HeaderBehavior: whitelist
      Headers:
        - Accept
        - Accept-Encoding
        - X-Org-Key  # For tenant isolation
```

CloudFront requires Lambda@Edge for header stripping:

```javascript
// Lambda@Edge: Viewer Response
exports.handler = async (event) => {
  const response = event.Records[0].cf.response;
  
  // Remove internal headers
  delete response.headers['x-org-key'];
  delete response.headers['surrogate-key'];
  
  return response;
};
```

---

## Cost Estimation

At 10M users (estimated 50M requests/day):

| Provider | Estimated Monthly Cost |
|----------|----------------------|
| Cloudflare Pro | ~$200 + bandwidth |
| Cloudflare Enterprise | ~$5,000 (includes purge-by-tag) |
| AWS CloudFront | ~$3,000-5,000 |
| Fastly | ~$4,000-6,000 |

Actual costs depend on:
- Request volume
- Bandwidth (egress)
- Edge compute usage
- Purge frequency

---

## Next Steps

1. Review this guide with your infrastructure team
2. Set up Cloudflare account and add domain
3. Start with basic caching rules on staging
4. Gradually enable features and monitor metrics
5. Integrate purge API with backend events

For questions, refer to:
- [Cloudflare Docs](https://developers.cloudflare.com/)
- [Backend Middleware Docs](../backend/middleware/README.md)
- [Networking Plan](./NETWORKING_AND_REALTIME_IMPROVEMENTS.md)

