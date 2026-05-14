import { NextResponse } from "next/server";
import os from "node:os";
import { getDatabase } from "@/lib/sqlite/connection.js";
import { getProviderConnections, getCombos, getApiKeys, getSettings } from "@/lib/localDb.js";

const START_TIME = globalThis.__9router_start_time ?? (globalThis.__9router_start_time = Date.now());

function getSystemInfo() {
  const mem = process.memoryUsage();
  return {
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
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

  const status = database.ok && database.integrity === "ok" ? "healthy" : "issues";

  return NextResponse.json({
    status,
    timestamp: Date.now(),
    system,
    database,
    providers,
    tunnel,
    semanticCache,
  });
}
