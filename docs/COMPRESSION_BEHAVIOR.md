# Compression Behavior & Compatibility

## Client Behavior
- Primary path: uses browser `DecompressionStream('gzip')` to decode compressed batches.
- Fallback:
  - If `DecompressionStream` is unavailable and `REALTIME_DECOMP_POLYFILL=true` (localStorage), a small polyfill (`fflate`) is lazy‑loaded from CDN and used to decode.
  - If decoding fails, client ignores the compressed payload and uses the standard `messages` array (always included).

## Server Behavior
- Server always includes normal `messages` array in batch responses.
- If `REALTIME_COMPRESS_BATCHES` is not explicitly disabled, server attaches a base64‑encoded gzip of the messages under `data` and sets `compressed=true` whenever payload exceeds threshold.

## Ordering
- Client awaits gzip decoding to preserve strict ordering even for compressed batches.

## Telemetry
- Client sends best‑effort telemetry:
  - `compression_support` (hasDecompressionStream, polyfillEnabled)
  - `compressed_decode_success` (bytes, usedPolyfill)
  - `compressed_decode_failure`
- Server exposes:
  - `compressedBatchesServed`, `batchesSent`, `hitRate` via `/v2/realtime/metrics`.

## Rollout Guidance
- Default: compression enabled on server; clients decode when supported.
- Only enable polyfill (`REALTIME_DECOMP_POLYFILL=true`) if browser analytics indicate >5% without `DecompressionStream`.

## QA
- Verify instant UI remains unchanged on modern Chrome/Safari/Firefox.
- Confirm decode success events present and failures near 0% on supported browsers.


