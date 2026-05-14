"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TelemetryCard from "./TelemetryCard";

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUptime(seconds = 0) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatCard({ icon, label, value, sub, tone = "bg-deep-slate" }) {
  return (
    <div className={`rounded-[6px] border border-charcoal-grey p-4 ${tone}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[16px] text-fog-grey">{icon}</span>
        <span className="text-[11px] font-[590] uppercase tracking-[0.05em] text-fog-grey">{label}</span>
      </div>
      <p className="text-[20px] font-[510] text-porcelain tracking-[-0.2px]">{value}</p>
      {sub && <p className="text-[11px] text-storm-cloud mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon, title, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-fog-grey">{icon}</span>
        <h2 className="text-[13px] font-[510] text-porcelain tracking-[-0.12px]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function HealthPage() {
  const [data, setData] = useState(null);
  const telemetryRef = useRef(null);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const t = setInterval(fetchHealth, 15_000);
    return () => clearInterval(t);
  }, [fetchHealth]);

  if (!data && !error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <span className="material-symbols-outlined text-[32px] text-fog-grey animate-spin">progress_activity</span>
          <p className="text-[13px] text-storm-cloud mt-3">Loading health data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <div className="rounded-[6px] border border-warning-red/30 bg-warning-red/8 p-5 text-center">
          <span className="material-symbols-outlined text-[28px] text-warning-red mb-2">error</span>
          <p className="text-[13px] text-warning-red">{error}</p>
          <button
            onClick={fetchHealth}
            className="mt-3 h-7 px-4 rounded-[6px] border border-charcoal-grey bg-graphite text-[12px] text-porcelain hover:bg-deep-slate"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { system, database, providers, tunnel, semanticCache } = data;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-[590] text-porcelain tracking-[-0.18px]">System Health</h1>
          <p className="text-[12px] text-storm-cloud mt-0.5">
            Live overview of system status, database, providers, and cache.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[11px] text-fog-grey hidden sm:block">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => {
              fetchHealth();
              telemetryRef.current?.refresh();
            }}
            className="flex items-center justify-center size-7 rounded-[4px] border border-charcoal-grey text-storm-cloud hover:bg-deep-slate hover:text-porcelain"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-[6px] border px-4 py-3 flex items-center gap-3 ${
          data.status === "healthy" ? "border-emerald/30 bg-emerald/8" : "border-warning-red/30 bg-warning-red/8"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] ${
            data.status === "healthy" ? "text-emerald" : "text-warning-red"
          }`}
        >
          {data.status === "healthy" ? "check_circle" : "error"}
        </span>
        <span className={`text-[13px] font-[510] ${data.status === "healthy" ? "text-emerald" : "text-warning-red"}`}>
          {data.status === "healthy" ? "All systems operational" : "Issues detected"}
        </span>
        <span className="ml-auto text-[11px] text-fog-grey">{new Date(data.timestamp).toLocaleTimeString()}</span>
      </div>

      {/* Telemetry */}
      <TelemetryCard ref={telemetryRef} />

      {/* System + DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="timer" label="Uptime" value={formatUptime(system.uptime)} tone="bg-graphite" />
        <StatCard
          icon="code"
          label="Node.js"
          value={system.nodeVersion}
          sub={`${system.platform} / ${system.arch}`}
          tone="bg-graphite"
        />
        <StatCard
          icon="memory"
          label="Memory RSS"
          value={formatBytes(system.memoryUsage?.rss ?? 0)}
          sub={`Heap: ${formatBytes(system.memoryUsage?.heapUsed ?? 0)} / ${formatBytes(system.memoryUsage?.heapTotal ?? 0)}`}
          tone="bg-graphite"
        />
        <StatCard
          icon="developer_board"
          label="System Memory"
          value={formatBytes(system.freeMemory ?? 0)}
          sub={`Free of ${formatBytes(system.totalMemory ?? 0)}`}
          tone="bg-graphite"
        />
      </div>

      {/* Database */}
      <div className="rounded-[6px] border border-charcoal-grey bg-graphite p-5">
        <SectionHeader icon="database" title="Database">
          <span
            className={`text-[11px] font-[590] px-2 py-0.5 rounded-[4px] ${
              database.ok && database.integrity === "ok"
                ? "bg-emerald/10 text-emerald"
                : "bg-warning-red/10 text-warning-red"
            }`}
          >
            {database.ok && database.integrity === "ok" ? "Healthy" : "Issues"}
          </span>
        </SectionHeader>
        {database.ok ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-3">
              <p className="text-[10px] text-fog-grey uppercase tracking-[0.05em] mb-1">Schema</p>
              <p className="text-[13px] font-[510] text-porcelain">v{database.schemaVersion}</p>
            </div>
            <div className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-3">
              <p className="text-[10px] text-fog-grey uppercase tracking-[0.05em] mb-1">Integrity</p>
              <p
                className={`text-[13px] font-[510] ${database.integrity === "ok" ? "text-emerald" : "text-warning-red"}`}
              >
                {database.integrity}
              </p>
            </div>
            <div className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-3">
              <p className="text-[10px] text-fog-grey uppercase tracking-[0.05em] mb-1">Size</p>
              <p className="text-[13px] font-[510] text-porcelain">{formatBytes(database.sizeBytes ?? 0)}</p>
            </div>
            <div className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-3">
              <p className="text-[10px] text-fog-grey uppercase tracking-[0.05em] mb-1">Journal</p>
              <p className="text-[13px] font-[510] text-porcelain uppercase">{database.journalMode}</p>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-warning-red">{database.error}</p>
        )}
      </div>

      {/* Providers + Tunnel + Cache */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Providers */}
        <div className="rounded-[6px] border border-charcoal-grey bg-graphite p-5">
          <SectionHeader icon="dns" title="Providers" />
          <div className="space-y-2">
            {[
              { label: "Total connections", value: providers.total },
              { label: "Enabled", value: providers.enabled },
              { label: "Combos", value: providers.combos },
              { label: "API keys", value: providers.apiKeys },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-1 border-b border-charcoal-grey last:border-0"
              >
                <span className="text-[12px] text-storm-cloud">{row.label}</span>
                <span className="text-[12px] font-[510] text-porcelain">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tunnel */}
        <div className="rounded-[6px] border border-charcoal-grey bg-graphite p-5">
          <SectionHeader icon="vpn_lock" title="Tunnel" />
          <div className="space-y-2">
            {[
              {
                label: "Cloudflare",
                active: tunnel.cloudflareEnabled,
                url: tunnel.cloudflareUrl,
              },
              {
                label: "Tailscale",
                active: tunnel.tailscaleEnabled,
                url: tunnel.tailscaleUrl,
              },
            ].map((t) => (
              <div
                key={t.label}
                className="flex items-start justify-between py-1 border-b border-charcoal-grey last:border-0 gap-2"
              >
                <span className="text-[12px] text-storm-cloud">{t.label}</span>
                <div className="text-right">
                  <span
                    className={`text-[11px] font-[590] px-1.5 py-0.5 rounded-[4px] ${
                      t.active ? "bg-emerald/10 text-emerald" : "bg-deep-slate text-fog-grey"
                    }`}
                  >
                    {t.active ? "Active" : "Inactive"}
                  </span>
                  {t.active && t.url && (
                    <p className="text-[10px] text-fog-grey font-mono mt-0.5 truncate max-w-[140px]">{t.url}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic Cache */}
        <div className="rounded-[6px] border border-charcoal-grey bg-graphite p-5">
          <SectionHeader icon="cached" title="Semantic Cache">
            <span
              className={`text-[11px] font-[590] px-2 py-0.5 rounded-[4px] ${
                semanticCache.enabled ? "bg-emerald/10 text-emerald" : "bg-deep-slate text-fog-grey"
              }`}
            >
              {semanticCache.enabled ? "Enabled" : "Disabled"}
            </span>
          </SectionHeader>
          <div className="space-y-2">
            {[
              { label: "Max size", value: semanticCache.maxSize ?? "—" },
              {
                label: "TTL",
                value: semanticCache.ttlMs ? `${Math.round(semanticCache.ttlMs / 60000)}m` : "—",
              },
              { label: "Entries", value: semanticCache.size ?? "—" },
              {
                label: "Hit rate",
                value: typeof semanticCache.hitRate === "number" ? `${semanticCache.hitRate.toFixed(1)}%` : "—",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-1 border-b border-charcoal-grey last:border-0"
              >
                <span className="text-[12px] text-storm-cloud">{row.label}</span>
                <span className="text-[12px] font-[510] text-porcelain">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
