"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/shared/utils/cn";

function TypeBadge({ type }) {
  const styles = {
    http: "bg-aether-blue/10 text-aether-blue border-aether-blue/20",
    vercel: "bg-amethyst/10 text-amethyst border-amethyst/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-[4px] border text-[10px] font-[590] uppercase",
        styles[type] ?? "bg-deep-slate text-fog-grey border-charcoal-grey",
      )}
    >
      {type || "http"}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-[590]",
        active ? "bg-emerald/10 text-emerald" : "bg-deep-slate text-fog-grey",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald" : "bg-fog-grey")} />
      {active ? "Enabled" : "Disabled"}
    </span>
  );
}

export default function ProxyLogsTab() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy-pools?includeUsage=true");
      if (!res.ok) throw new Error("Failed to fetch proxy pools");
      const data = await res.json();
      setPools(data.proxyPools ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const handleTest = async (pool) => {
    setTesting(pool.id);
    setTestResults((prev) => ({ ...prev, [pool.id]: null }));
    try {
      const res = await fetch(`/api/proxy-pools/${pool.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [pool.id]: res.ok
          ? { ok: true, message: data.message ?? "Connection successful" }
          : { ok: false, message: data.error ?? "Test failed" },
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [pool.id]: { ok: false, message: "Request failed" } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-[510] text-porcelain tracking-[-0.13px]">Proxy Pools</h2>
          {!loading && <span className="text-[11px] text-fog-grey">{pools.length} configured</span>}
        </div>
        <button
          onClick={fetchPools}
          className="flex items-center justify-center size-7 rounded-[4px] border border-charcoal-grey text-storm-cloud hover:bg-deep-slate hover:text-porcelain transition-colors duration-100"
          title="Refresh"
        >
          <span className={cn("material-symbols-outlined text-[15px]", loading && "animate-spin")}>refresh</span>
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-[6px] border border-charcoal-grey bg-deep-slate">
        <span className="material-symbols-outlined text-[14px] text-fog-grey shrink-0 mt-0.5">info</span>
        <p className="text-[11px] text-fog-grey leading-[1.5]">
          Live proxy request logging is not available. Showing configured proxy pools. Manage pools in{" "}
          <a
            href="/dashboard/proxy-pools"
            className="text-storm-cloud hover:text-porcelain underline underline-offset-2 transition-colors duration-100"
          >
            Proxy Pools
          </a>
          .
        </p>
      </div>

      {/* Table */}
      <div className="rounded-[6px] border border-charcoal-grey overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-fog-grey">
            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            Loading proxy pools...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="material-symbols-outlined text-[28px] text-warning-red">error</span>
            <p className="text-[12px] text-warning-red">{error}</p>
            <button
              onClick={fetchPools}
              className="mt-1 h-7 px-3 rounded-[6px] border border-charcoal-grey text-[12px] text-storm-cloud hover:bg-deep-slate hover:text-porcelain transition-colors duration-100"
            >
              Retry
            </button>
          </div>
        ) : pools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="material-symbols-outlined text-[28px] text-fog-grey">lan</span>
            <p className="text-[12px] text-fog-grey">No proxy pools configured.</p>
            <a
              href="/dashboard/proxy-pools"
              className="mt-1 h-7 px-3 inline-flex items-center rounded-[6px] border border-charcoal-grey text-[12px] text-storm-cloud hover:bg-deep-slate hover:text-porcelain transition-colors duration-100"
            >
              Configure proxy pools
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-[12px]">
              <thead className="bg-pitch-black border-b border-charcoal-grey">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Name
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    URL
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Type
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Connections
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Status
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pools.map((pool) => (
                  <>
                    <tr
                      key={pool.id}
                      className="border-b border-charcoal-grey/50 last:border-0 hover:bg-deep-slate transition-colors duration-100"
                    >
                      <td className="px-3 py-2.5 border-r border-charcoal-grey/50 font-[510] text-porcelain">
                        {pool.name}
                      </td>
                      <td
                        className="px-3 py-2.5 border-r border-charcoal-grey/50 text-storm-cloud font-mono max-w-[260px] truncate"
                        title={pool.proxyUrl}
                      >
                        {pool.proxyUrl}
                      </td>
                      <td className="px-3 py-2.5 border-r border-charcoal-grey/50">
                        <TypeBadge type={pool.type} />
                      </td>
                      <td className="px-3 py-2.5 border-r border-charcoal-grey/50 text-fog-grey">
                        {pool.boundConnectionCount ?? 0}
                      </td>
                      <td className="px-3 py-2.5 border-r border-charcoal-grey/50">
                        <StatusBadge active={pool.isActive} />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => handleTest(pool)}
                          disabled={testing === pool.id}
                          className="flex items-center gap-1.5 h-6 px-2.5 rounded-[4px] border border-charcoal-grey text-[11px] text-storm-cloud hover:bg-deep-slate hover:text-porcelain disabled:opacity-50 transition-colors duration-100"
                        >
                          {testing === pool.id ? (
                            <span className="material-symbols-outlined text-[12px] animate-spin">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[12px]">network_check</span>
                          )}
                          Test
                        </button>
                      </td>
                    </tr>
                    {testResults[pool.id] && (
                      <tr key={`${pool.id}-result`} className="border-b border-charcoal-grey/50 last:border-0">
                        <td colSpan={6} className="px-3 py-2">
                          <div
                            className={cn(
                              "flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-[4px]",
                              testResults[pool.id].ok
                                ? "bg-emerald/8 text-emerald border border-emerald/20"
                                : "bg-warning-red/8 text-warning-red border border-warning-red/20",
                            )}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {testResults[pool.id].ok ? "check_circle" : "error"}
                            </span>
                            {testResults[pool.id].message}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
