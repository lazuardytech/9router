"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardSkeleton, Input, Toggle } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

function staleMinutesToMs(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  const minutes = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  return minutes * 60 * 1000;
}

export default function CacheClient() {
  const notify = useNotificationStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invalidating, setInvalidating] = useState(false);

  const [stats, setStats] = useState({
    memoryEntries: 0,
    dbEntries: 0,
    hits: 0,
    misses: 0,
    hitRate: "0.0",
    tokensSaved: 0,
  });

  const [config, setConfig] = useState({
    semanticCacheEnabled: true,
    semanticCacheMaxSize: "100",
    semanticCacheTTLMinutes: "30",
  });

  const [maintenance, setMaintenance] = useState({
    model: "",
    signature: "",
    staleMinutes: "60",
  });

  const loadData = useCallback(
    async (isInitial = false) => {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch("/api/cache", { cache: "no-store" });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load cache data");
        }

        const payload = await res.json();
        const cacheStats = payload.semanticCache || {};
        const cacheConfig = payload.config || {};

        setStats({
          memoryEntries: Number(cacheStats.memoryEntries || 0),
          dbEntries: Number(cacheStats.dbEntries || 0),
          hits: Number(cacheStats.hits || 0),
          misses: Number(cacheStats.misses || 0),
          hitRate: String(cacheStats.hitRate || "0.0"),
          tokensSaved: Number(cacheStats.tokensSaved || 0),
        });

        setConfig({
          semanticCacheEnabled: cacheConfig.semanticCacheEnabled !== false,
          semanticCacheMaxSize: String(cacheConfig.semanticCacheMaxSize ?? 100),
          semanticCacheTTLMinutes: String(Math.max(1, Math.round((cacheConfig.semanticCacheTTL ?? 1800000) / 60000))),
        });
      } catch (error) {
        notify.error(error?.message || "Failed to load cache data");
      } finally {
        if (isInitial) setLoading(false);
        else setRefreshing(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const handleSaveConfig = async () => {
    const maxSize = Number.parseInt(config.semanticCacheMaxSize, 10);
    const ttlMinutes = Number.parseInt(config.semanticCacheTTLMinutes, 10);

    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      notify.error("Cache max size harus integer positif");
      return;
    }
    if (!Number.isInteger(ttlMinutes) || ttlMinutes <= 0) {
      notify.error("Cache TTL minutes harus integer positif");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/cache-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semanticCacheEnabled: config.semanticCacheEnabled,
          semanticCacheMaxSize: maxSize,
          semanticCacheTTL: ttlMinutes * 60 * 1000,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update cache config");
      }

      notify.success("Cache config updated");
      await loadData(false);
    } catch (error) {
      notify.error(error?.message || "Failed to update cache config");
    } finally {
      setSaving(false);
    }
  };

  const runInvalidation = async (query) => {
    setInvalidating(true);
    try {
      const target = query ? `/api/cache?${query}` : "/api/cache";
      const res = await fetch(target, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Cache invalidation failed");
      }
      notify.success("Cache invalidated");
      await loadData(false);
    } catch (error) {
      notify.error(error?.message || "Cache invalidation failed");
    } finally {
      setInvalidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Cache</h1>
        <p className="text-sm text-text-muted">Configure semantic cache behavior and run cache maintenance.</p>
      </div>

      <Card
        title="Cache Settings"
        subtitle="Controls semantic cache enablement, size, and TTL"
        icon="tune"
        action={
          <Button size="sm" icon="save" onClick={handleSaveConfig} loading={saving}>
            Save
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            checked={config.semanticCacheEnabled}
            onChange={(semanticCacheEnabled) => setConfig((prev) => ({ ...prev, semanticCacheEnabled }))}
            label="Enable Semantic Cache"
            description="Allow cache reads/writes for non-streaming deterministic requests."
          />
          <Input
            label="Cache Max Size"
            type="number"
            min="1"
            value={config.semanticCacheMaxSize}
            onChange={(event) => setConfig((prev) => ({ ...prev, semanticCacheMaxSize: event.target.value }))}
          />
          <Input
            label="Cache TTL (minutes)"
            type="number"
            min="1"
            value={config.semanticCacheTTLMinutes}
            onChange={(event) => setConfig((prev) => ({ ...prev, semanticCacheTTLMinutes: event.target.value }))}
          />
        </div>
      </Card>

      <Card
        title="Cache Stats"
        subtitle="Live semantic cache counters"
        icon="monitoring"
        action={
          <Button size="sm" variant="secondary" icon="refresh" onClick={() => loadData(false)} loading={refreshing}>
            Refresh
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Memory Entries" value={stats.memoryEntries} />
          <Stat label="DB Entries" value={stats.dbEntries} />
          <Stat label="Hits" value={stats.hits} />
          <Stat label="Misses" value={stats.misses} />
          <Stat label="Hit Rate" value={`${stats.hitRate}%`} />
          <Stat label="Tokens Saved" value={stats.tokensSaved} />
        </div>
      </Card>

      <Card title="Maintenance" subtitle="Invalidate cache entries by scope" icon="cleaning_services">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Invalidate by Model"
            placeholder="example: melma/zen"
            value={maintenance.model}
            onChange={(event) => setMaintenance((prev) => ({ ...prev, model: event.target.value }))}
          />
          <div className="flex items-end">
            <Button
              variant="secondary"
              icon="delete_sweep"
              loading={invalidating}
              disabled={!maintenance.model.trim()}
              onClick={() => runInvalidation(`model=${encodeURIComponent(maintenance.model.trim())}`)}
              className="w-full"
            >
              Invalidate Model
            </Button>
          </div>

          <Input
            label="Invalidate by Signature"
            placeholder="sha256 signature"
            value={maintenance.signature}
            onChange={(event) => setMaintenance((prev) => ({ ...prev, signature: event.target.value }))}
          />
          <div className="flex items-end">
            <Button
              variant="secondary"
              icon="delete_sweep"
              loading={invalidating}
              disabled={!maintenance.signature.trim()}
              onClick={() => runInvalidation(`signature=${encodeURIComponent(maintenance.signature.trim())}`)}
              className="w-full"
            >
              Invalidate Signature
            </Button>
          </div>

          <Input
            label="Invalidate Stale (minutes)"
            type="number"
            min="1"
            value={maintenance.staleMinutes}
            onChange={(event) => setMaintenance((prev) => ({ ...prev, staleMinutes: event.target.value }))}
          />
          <div className="flex items-end">
            <Button
              variant="secondary"
              icon="auto_delete"
              loading={invalidating}
              onClick={() =>
                runInvalidation(`staleMs=${encodeURIComponent(String(staleMinutesToMs(maintenance.staleMinutes)))}`)
              }
              className="w-full"
            >
              Invalidate Stale
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-border-subtle pt-4">
          <Button
            variant="danger"
            icon="delete_forever"
            loading={invalidating}
            onClick={() => runInvalidation("")}
            className="w-full sm:w-auto"
          >
            Clear All Cache
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-main">{value}</p>
    </div>
  );
}
