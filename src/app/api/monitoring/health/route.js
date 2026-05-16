import os from "node:os";
import { NextResponse } from "next/server";
import { getApiKeys, getCombos, getProviderConnections, getSettings } from "@/lib/localDb.js";
import { getDatabase } from "@/lib/sqlite/connection.js";
import { getQueueDepths } from "@/lib/usageDb.js";
import { AI_PROVIDERS } from "@/shared/constants/providers.js";

const START_TIME = globalThis.__pod_start_time ?? (globalThis.__pod_start_time = Date.now());

function getSystemInfo() {
  const mem = process.memoryUsage();
  return {
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
    loadAvg: os.loadavg(),
    cpus: os.cpus().length,
    freeMemory: os.freemem(),
    totalMemory: os.totalmem(),
  };
}

function getDbInfo() {
  try {
    const db = getDatabase();
    const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
    const integrity = db.prepare("PRAGMA integrity_check").get();
    const pageCount = db.prepare("PRAGMA page_count").get();
    const pageSize = db.prepare("PRAGMA page_size").get();
    const walMode = db.prepare("PRAGMA journal_mode").get();
    return {
      ok: true,
      schemaVersion: version?.value ?? "unknown",
      integrity: integrity?.integrity_check ?? "ok",
      sizeBytes: (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 4096),
      journalMode: walMode?.journal_mode ?? "unknown",
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function GET() {
  const system = getSystemInfo();
  const database = getDbInfo();

  const [connections, combos, apiKeys, settings] = await Promise.allSettled([
    getProviderConnections(),
    getCombos(),
    getApiKeys(),
    getSettings(),
  ]);

  const conns = connections.status === "fulfilled" ? connections.value : [];
  const comboList = combos.status === "fulfilled" ? combos.value : [];
  const keys = apiKeys.status === "fulfilled" ? apiKeys.value : [];
  const cfg = settings.status === "fulfilled" ? settings.value : {};

  const providers = {
    total: conns.length,
    enabled: conns.filter((c) => c.enabled !== false).length,
    combos: comboList.length,
    apiKeys: keys.length,
  };

  const tunnel = {
    cloudflareEnabled: cfg.tunnelEnabled ?? false,
    cloudflareUrl: cfg.tunnelUrl ?? "",
    tailscaleEnabled: cfg.tailscaleEnabled ?? false,
    tailscaleUrl: cfg.tailscaleUrl ?? "",
  };

  const semanticCache = {
    enabled: cfg.semanticCacheEnabled ?? false,
    maxSize: cfg.semanticCacheMaxSize ?? 100,
    ttlMs: cfg.semanticCacheTTL ?? 1800000,
  };

  // ── Provider Health (grouped by provider, worst state wins) ────────────────
  const now = Date.now();
  const providerHealthMap = {};
  for (const c of conns) {
    const isRateLimited = c.rateLimitedUntil && new Date(c.rateLimitedUntil).getTime() > now;
    const retryAfterMs = isRateLimited ? new Date(c.rateLimitedUntil).getTime() - now : 0;
    let state = "CLOSED";
    if (isRateLimited) state = "OPEN";
    else if (c.testStatus === "error") state = "HALF_OPEN";
    const providerInfo = AI_PROVIDERS[c.provider];
    const key = c.provider;
    if (!providerHealthMap[key]) {
      providerHealthMap[key] = {
        provider: c.provider,
        providerName: providerInfo?.name || c.provider,
        state: "CLOSED",
        retryAfterMs: 0,
        rateLimitedUntil: null,
        connectionCount: 0,
      };
    }
    const entry = providerHealthMap[key];
    entry.connectionCount += 1;
    const stateRank = { OPEN: 2, HALF_OPEN: 1, CLOSED: 0 };
    if (stateRank[state] > stateRank[entry.state]) {
      entry.state = state;
      entry.retryAfterMs = retryAfterMs;
      entry.rateLimitedUntil = c.rateLimitedUntil || null;
    }
  }
  const providerHealth = Object.values(providerHealthMap);

  // ── Rate Limit Status (grouped by provider) ───────────────────────────────
  const rateLimitByProvider = {};
  for (const c of conns) {
    const isRateLimited = c.rateLimitedUntil && new Date(c.rateLimitedUntil).getTime() > now;
    if (!isRateLimited) continue;
    const key = c.provider;
    if (!rateLimitByProvider[key]) {
      const providerInfo = AI_PROVIDERS[key];
      rateLimitByProvider[key] = {
        provider: key,
        providerName: providerInfo?.name || key,
        rateLimitedCount: 0,
        connections: [],
      };
    }
    rateLimitByProvider[key].rateLimitedCount += 1;
    rateLimitByProvider[key].connections.push({
      connectionId: c.id,
      connectionName: c.name || c.provider,
      rateLimitedUntil: c.rateLimitedUntil,
      retryAfterMs: new Date(c.rateLimitedUntil).getTime() - now,
    });
  }

  // ── Blocked Model Status (modelLock_* fields on connections) ──────────────
  const MODEL_LOCK_PREFIX = "modelLock_";
  const blockedByModel = {};
  for (const c of conns) {
    const providerInfo = AI_PROVIDERS[c.provider];
    for (const [key, val] of Object.entries(c)) {
      if (!key.startsWith(MODEL_LOCK_PREFIX) || !val) continue;
      const expiry = new Date(val).getTime();
      if (expiry <= now) continue;
      const modelName = key.slice(MODEL_LOCK_PREFIX.length);
      if (!blockedByModel[modelName]) {
        blockedByModel[modelName] = {
          model: modelName,
          blockedCount: 0,
          connections: [],
          earliestUnblockAt: null,
        };
      }
      blockedByModel[modelName].blockedCount += 1;
      blockedByModel[modelName].connections.push({
        connectionId: c.id,
        connectionName: c.name || c.provider,
        provider: c.provider,
        providerName: providerInfo?.name || c.provider,
        blockedUntil: val,
        retryAfterMs: expiry - now,
      });
      if (
        !blockedByModel[modelName].earliestUnblockAt ||
        expiry < new Date(blockedByModel[modelName].earliestUnblockAt).getTime()
      ) {
        blockedByModel[modelName].earliestUnblockAt = val;
      }
    }
  }

  const status = database.ok && database.integrity === "ok" ? "healthy" : "issues";

  const queueDepths = getQueueDepths();

  return NextResponse.json({
    status,
    timestamp: Date.now(),
    system,
    database,
    providers,
    tunnel,
    semanticCache,
    queueDepths,
    providerHealth,
    rateLimitStatus: Object.values(rateLimitByProvider),
    blockedModelStatus: Object.values(blockedByModel),
  });
}
