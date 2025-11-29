# Encore Cache Backend Status

## Current Status: ⚠️ Stub Implementation

The Encore Cache backend (`backend/cache/backends/encore.ts`) is currently using a **temporary in-memory stub implementation** because the `encore.dev/storage/cache` API is not yet available in Encore runtime version v1.51.5.

## Why a Stub?

When attempting to import `encore.dev/storage/cache`, we get:
```
error: unable to resolve module encore.dev/storage/cache: failed to get the node_modules path
```

This indicates that the Encore cache storage API is either:
1. Not yet released in the current Encore version
2. Requires a different import path
3. Coming in a future Encore release

## Current Implementation

**File**: `backend/cache/backends/encore.ts`

The stub provides:
- ✅ Full `CacheBackend` interface compliance
- ✅ Basic get/set/delete operations
- ✅ TTL parsing and expiration
- ✅ Same external API as the real implementation
- ⚠️ Process-local only (not distributed)

**What it does**:
```typescript
class EncoreCacheStub {
  private cache = new Map<string, { value: any; expiresAt: number }>();
  
  async get(key: string): Promise<any> { /* ... */ }
  async set(key: string, value: any, options?: { ttl?: string }): Promise<void> { /* ... */ }
  async delete(key: string): Promise<void> { /* ... */ }
}
```

## Impact on Tiered Cache

**Current Behavior**:
- `CACHE_TIERING=L1` → Memory only (works perfectly)
- `CACHE_TIERING=L1L2` → Memory + Stub (works, but L2 is process-local)
- `CACHE_TIERING=L1L2L3` → Memory + Stub + Redis (works, L3 provides distribution)

**Recommendation for Now**:
```bash
# Development & Staging
CACHE_TIERING=L1  # Pure memory - simplest and works great

# Production (if you need distribution)
CACHE_TIERING=L1L2L3  # Memory + Stub + Redis
REDIS_HOST=your-redis.example.com
```

Or simply use:
```bash
CACHE_TIERING=L1  # Until Encore cache API is available
```

## When Encore Cache Becomes Available

Once `encore.dev/storage/cache` is available in a future Encore release:

1. **Update the import** in `backend/cache/backends/encore.ts`:
   ```typescript
   // Uncomment this line:
   import { cache } from "encore.dev/storage/cache";
   
   // Remove the EncoreCacheStub class
   
   // Update constructor to use real API:
   this.cluster = cache.NewCluster(clusterName, {
     evictionPolicy: cache[evictionPolicy],
     maxEntries: maxEntries,
   });
   ```

2. **No other changes needed**:
   - Cache factory already configured
   - Tiered orchestrator ready
   - All consumers using the interface
   - Configuration system in place

3. **Test and deploy**:
   ```bash
   npm install encore.dev@latest  # Get new version
   encore run                     # Should work immediately
   ```

## Monitoring the Encore Roadmap

To check when cache storage becomes available:
- Encore Docs: https://encore.dev/docs
- Encore Changelog: https://encore.dev/changelog
- Encore Discord: Ask about cache storage timeline

## Alternative: Use Redis for L2

If you need distributed caching now and can't wait for Encore cache:

```bash
# Use Redis as L2 (skip stub entirely)
CACHE_TIERING=L1L2L3  # or just L1L3 if you modify config
REDIS_HOST=your-redis.example.com
REDIS_PORT=6379
REDIS_USE_TLS=true
```

Redis provides:
- ✅ True distributed caching
- ✅ Production-ready
- ✅ Proven at scale
- ✅ Works right now

## Summary

| Scenario | Recommendation | Distribution | Performance |
|----------|----------------|--------------|-------------|
| **Development** | `CACHE_TIERING=L1` | No (fine for dev) | Excellent |
| **Staging** | `CACHE_TIERING=L1` | No (fine for staging) | Excellent |
| **Production (small)** | `CACHE_TIERING=L1` | No | Good |
| **Production (scale)** | `CACHE_TIERING=L1L2L3` + Redis | Yes (via Redis) | Excellent |

**Bottom Line**: The cache system works perfectly right now with L1 (memory) and L3 (Redis). The L2 (Encore) tier will provide additional benefits when the API becomes available, but it's not blocking deployment.

## Migration Path

```
Current:  L1 (Memory) → Works great ✅
↓
Phase 1:  L1 + L3 (Redis) → Add distribution if needed ✅
↓
Phase 2:  L1 + L2 (Encore) + L3 → When API available 🔮
```

You can deploy and use the tiered cache system **today** with excellent results using L1 or L1+L3.

---

**Last Updated**: November 7, 2025
**Encore Version**: v1.51.5
**Status**: Functional with stub, ready for real API when available

