# Open Issues

Tracked problems that have been partially or fully fixed but may still have residual symptoms.
Last updated: **2026-05-17** (baseline **v0.0.22**).

---

## Issue 1 — Performance Regression After Memory Leak Fix

### Background

`be7cbe2` (v0.0.13) fixed a 1.2 GB RSS leak by:
- Reducing SQLite pragmas (`cache_size` 64 MB → 16 MB, `mmap_size` 256 MB → 64 MB)
- Adding SSE abort listeners on `proxy-pools/stream` and `request-logs/stream`
- Replacing plain `Map` in `memory/store.js` with `LRUCache` (500 entries, 4 MB, 300 s TTL)
- Adding `--smol` to Dockerfile CMD

A follow-up commit (`v0.0.15`) removed `--smol` and replaced it with cache env vars in Dockerfile:
```
SEMANTIC_CACHE_MAX_BYTES=2097152   (2 MB)
SEMANTIC_CACHE_MAX_SIZE=50
PROMPT_CACHE_MAX_BYTES=1048576     (1 MB)
PROMPT_CACHE_MAX_SIZE=25
```

### Root Cause of Slowdown

Two contributing factors:

1. **Cache env vars are very conservative.** `SEMANTIC_CACHE_MAX_SIZE=50` and `PROMPT_CACHE_MAX_SIZE=25` mean the in-memory caches evict aggressively, causing more upstream round-trips than before the leak fix. Under moderate load this manifests as higher latency per request.

2. **`--smol` was removed but GC pressure was not otherwise addressed.** Bun's JSC heap grows freely again; under sustained load RSS climbs back toward the pre-fix range before GC kicks in, causing GC pause spikes.

### Current State (v0.0.22)

- `be7cbe2` fixes are all in place and correct.
- `--smol` is gone from Dockerfile (correct — it throttled throughput).
- Cache env vars are set conservatively in Dockerfile.
- No further perf tuning has been applied.

### Files Involved

| File | Change |
|---|---|
| `Dockerfile` | Cache env vars, no `--smol` |
| `src/lib/sqlite/connection.js` | `cache_size=-16000`, `mmap_size=67108864` |
| `src/lib/memory/store.js` | LRUCache 500 entries / 4 MB / 300 s TTL |
| `src/app/api/proxy-pools/stream/route.js` | SSE abort cleanup |
| `src/app/api/usage/request-logs/stream/route.js` | SSE abort cleanup |

### Remaining Problem

- Cache sizes in Dockerfile may be too small for production workloads. Consider tuning upward if hit rate improves (see Issue 2) and memory budget allows.
- No profiling has been done post-`--smol` removal to confirm actual throughput numbers.

### Status: ⚠️ Partially mitigated — memory leak fixed, perf tuning incomplete

---

## Issue 2 — Semantic Cache Always 0% Hit Rate

### Background

Three separate root causes were found and fixed across multiple commits. All three must be applied together for cache hits to occur.

### Fix 1 — Memory Injection Signature Mismatch (`f591bc8`, v0.0.20)

**Root cause:** `generateSignature()` was called at cache-read time (line ~317 in `chatCore.js`) using `body.messages`. Then `injectMemory()` mutated `body.messages` by prepending memory entries. At cache-write time, `generateSignature()` was called again from the mutated `body.messages` — producing a different hash. Read and write signatures never matched → 0% hit rate.

**Fix:** Compute `cacheSignature` once before `injectMemory()` and reuse it for all write paths. Never recompute from `body.messages` at write time.

**Current state:** Fixed. `chatCore.js` lines ~317 and ~696/706/865 all use the pre-computed `cacheSignature`.

### Fix 2 — Temperature Threshold Too Strict (`b498bb4`, v0.0.13)

**Root cause:** `isCacheableForRead/Write` used `temperature !== 0` as the exclusion guard. Most clients (Cursor, Claude Code, etc.) send `temperature: 1` explicitly → every request was excluded from cache.

**Fix:** Changed guard to `temperature > 1`. Requests with `temperature <= 1` (including the common default of 1) are now cacheable.

**Current state:** Fixed in `src/lib/semanticCache.js`:
```js
const temp = body?.temperature ?? 0;
if (temp > 1) return false;
```

### Fix 3 — Temperature/top_p Normalization (`3942978`, v0.0.22)

**Root cause:** Clients that omit `temperature` entirely vs. clients that send `temperature: 1` explicitly produced different signatures because `generateSignature` had a default parameter of `temperature = 0`. A request with no temperature field hashed as `temperature: 0`; a request with `temperature: 1` hashed as `temperature: 1` → permanent miss between these two client styles.

**Fix:** Normalize `null`/`undefined` temperature and `top_p` to `1` (semantic default) inside `generateSignature`:
```js
const normalizedTemp = temperature == null ? 1 : temperature;
const normalizedTopP = topP == null ? 1 : topP;
```

**Current state:** Fixed in `src/lib/semanticCache.js` `generateSignature()`.

### Fix 4 — `approxRequestBytes` False Positives (`3942978`, v0.0.22)

**Root cause:** `approxRequestBytes` counted every non-string message content as a flat 512 bytes. Requests with array-format content blocks (Anthropic style) were over-counted, triggering `requestTooLargeForCache = true` and skipping cache entirely for normal-sized requests.

**Fix:** Properly sum text lengths inside content block arrays; count non-text parts as 256 bytes each.

**Current state:** Fixed in `open-sse/handlers/chatCore.js` lines ~297–312.

### Files Involved

| File | Role |
|---|---|
| `open-sse/handlers/chatCore.js` | Signature compute point, write paths, `approxRequestBytes` |
| `src/lib/semanticCache.js` | `generateSignature`, `isCacheableForRead`, `isCacheableForWrite` |

### Remaining Problem

All known root causes are fixed as of v0.0.22. If hit rate is still 0%:
1. Verify `semanticCacheEnabled = true` in Settings → Cache.
2. Check `SEMANTIC_CACHE_MAX_SIZE` env var — if set to 50 (Dockerfile default), cache fills quickly and evicts under load.
3. Check `MAX_REQUEST_BYTES_FOR_CACHE_CHECK` constant in `chatCore.js` — very large contexts still bypass cache by design.
4. Confirm requests are not sending `x-pod-no-cache: true` header.

### Status: ✅ All known root causes fixed in v0.0.22

---

## Issue 3 — Model Lock Status in /health Not Respecting Minimum Lockout Time

### Background

`b292560` (v0.0.20) added configurable minimum lockout time (`settings.minimumLockoutMinutes`). The feature applies a floor to `cooldownMs` in `markAccountUnavailable`, with exponential backoff multiplier.

### Fix 1 — Read-Before-Write Guard Too Aggressive (`b64176b`, v0.0.21)

**Root cause:** The guard that skips redundant DB writes used `existingExpiry > Date.now()` — meaning if any lock was already active, the new (potentially longer) cooldown from `minimumLockoutMinutes` was silently discarded. Increasing minimum lockout in Settings had no effect on already-locked models.

**Fix:** Changed guard to only skip if `existingExpiry >= newExpiry - 5000` (5 s tolerance). Now the DB is updated whenever the new cooldown is longer than the existing one.

**Fix 2 — `resetsAtMs` Path Skipped Minimum (`b64176b`, v0.0.21):** The provider-specific `resetsAtMs` path (e.g. Codex `usage_limit_reached`) computed `cooldownMs` and returned early before the minimum lockout block ran. Fixed by applying minimum after both paths compute `cooldownMs`.

**Current state:** Both fixes are in `src/sse/services/auth.js` lines ~282–313.

### How /health Displays Lockout

`src/app/api/monitoring/health/_health.js` reads `modelLock_*` keys directly from connection rows in SQLite. It does **not** re-apply `minimumLockoutMinutes` — it just reads whatever expiry timestamp is stored. This is correct: the minimum is enforced at write time in `markAccountUnavailable`, so the stored expiry already reflects the minimum.

### Files Involved

| File | Role |
|---|---|
| `src/sse/services/auth.js` | `markAccountUnavailable` — applies minimum, read-before-write guard |
| `src/app/api/monitoring/health/_health.js` | Reads `modelLock_*` from DB, builds `blockedModelStatus` |
| `src/app/(dashboard)/health/HealthClient.js` | Renders lockout status, clear button |

### Remaining Problem

The fixes in `b64176b` address the write path. However, **existing locks written before the fix** (with the old shorter cooldown) will not be retroactively extended. They will expire at their original time. New locks created after `b64176b` will correctly respect `minimumLockoutMinutes`.

If the /health page still shows unexpected short lockouts:
1. Clear existing locks manually via the "Clear lockout and recheck" button in /health.
2. Trigger a new error to write a fresh lock — it will now use the correct minimum.

### Status: ✅ Fixed in v0.0.21 — existing stale locks must be cleared manually

---

## Fix History Summary

| Commit | Version | Issue | Description |
|---|---|---|---|
| `be7cbe2` | v0.0.13 | #1 | Memory leak fixes: SSE abort, LRUCache, SQLite pragmas, `--smol` |
| `b498bb4` | v0.0.13 | #2 | Cache temperature threshold `!= 0` → `> 1` |
| `ad77420` | pre-v0.0.13 | #2 | Cache: treat `stream=undefined` as cacheable |
| `8d528a9` | pre-v0.0.13 | #2 | Thundering herd protection (in-flight dedup) |
| `f591bc8` | v0.0.20 | #2 | Cache: reuse pre-injection signature on write paths |
| `b292560` | v0.0.20 | #3 | Feat: configurable minimum lockout time |
| `b64176b` | v0.0.21 | #3 | Fix: minimum lockout not applied (guard + resetsAtMs path) |
| `3942978` | v0.0.22 | #2 | Cache: temperature/top_p normalization + approxRequestBytes fix |
