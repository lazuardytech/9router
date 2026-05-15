"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/shared/utils/cn";
import RequestLogDetail from "./RequestLogDetail";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtTokens = (n) => {
  if (n == null || n === "-") return "—";
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  if (isNaN(num)) return "—";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
};

const fmtLatency = (ms) => {
  if (ms == null) return "—";
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
};

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (!status) return null;
  const isPending = status.includes("PENDING");
  const isFailed = status.includes("FAILED");
  const isOk = status.includes("SUCCESS");
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-[590]",
        isOk && "bg-emerald/10 text-emerald",
        isFailed && "bg-warning-red/10 text-warning-red",
        isPending && "bg-aether-blue/10 text-aether-blue animate-pulse",
        !isOk && !isFailed && !isPending && "bg-deep-slate text-fog-grey",
      )}
    >
      {status}
    </span>
  );
}

function ProviderBadge({ provider }) {
  if (!provider || provider === "-") return <span className="text-fog-grey">—</span>;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-deep-slate border border-charcoal-grey text-[10px] font-[590] text-storm-cloud uppercase">
      {provider}
    </span>
  );
}

function ComboBadge({ combo }) {
  if (!combo) return <span className="text-fog-grey/40">—</span>;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-amethyst/10 border border-amethyst/20 text-[10px] text-amethyst">
      {combo}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RequestLogger({ sortBy, setSortBy, recording, setRecording, refreshRef }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");

  // Detail drawer state
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const prevSigRef = useRef("");

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/usage/request-logs?limit=300");
      if (!res.ok) return;
      const data = await res.json();
      // Skip re-render if IDs haven't changed
      const sig = JSON.stringify((data || []).slice(0, 20).map((l) => l.id));
      if (sig === prevSigRef.current) return;
      prevSigRef.current = sig;
      setLogs(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  // Expose fetchLogs to parent via refreshRef
  useEffect(() => {
    if (refreshRef) refreshRef.current = () => fetchLogs(false);
  }, [refreshRef, fetchLogs]);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => fetchLogs(false), 3000);
    return () => clearInterval(t);
  }, [recording, fetchLogs]);

  // Open detail drawer — fetch matched request_details
  const openDetail = useCallback(async (log) => {
    setSelectedLog(log);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/usage/request-logs/${log.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data.detail ?? null);
      }
    } catch {
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedLog(null);
    setDetailData(null);
  }, []);

  // Derived data
  const providers = useMemo(() => [...new Set(logs.map((l) => l.provider).filter((p) => p && p !== "-"))], [logs]);

  const filtered = useMemo(() => {
    let result = logs.filter((l) => {
      if (filterStatus === "ok" && !l.status?.includes("SUCCESS")) return false;
      if (filterStatus === "failed" && !l.status?.includes("FAILED")) return false;
      if (filterStatus === "pending" && !l.status?.includes("PENDING")) return false;
      if (filterStatus === "combo" && !l.combo) return false;
      if (filterProvider !== "all" && l.provider !== filterProvider) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.model?.toLowerCase().includes(q) ||
          l.provider?.toLowerCase().includes(q) ||
          l.account?.toLowerCase().includes(q) ||
          l.status?.toLowerCase().includes(q) ||
          l.combo?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Sort
    result = [...result];
    switch (sortBy) {
      case "oldest":
        result.reverse();
        break;
      case "tokens_desc":
        result.sort(
          (a, b) =>
            (b.promptTokens ?? 0) + (b.completionTokens ?? 0) - ((a.promptTokens ?? 0) + (a.completionTokens ?? 0)),
        );
        break;
      case "tokens_asc":
        result.sort(
          (a, b) =>
            (a.promptTokens ?? 0) + (a.completionTokens ?? 0) - ((b.promptTokens ?? 0) + (b.completionTokens ?? 0)),
        );
        break;
      // newest is default (already ordered by id DESC from API)
    }

    return result;
  }, [logs, filterStatus, filterProvider, search, sortBy]);

  const counts = useMemo(
    () => ({
      total: logs.length,
      ok: logs.filter((l) => l.status?.includes("SUCCESS")).length,
      failed: logs.filter((l) => l.status?.includes("FAILED")).length,
      pending: logs.filter((l) => l.status?.includes("PENDING")).length,
      combo: logs.filter((l) => l.combo).length,
    }),
    [logs],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Stats */}
        <div className="flex items-center gap-2 text-[11px] text-fog-grey mr-1">
          <span className="text-storm-cloud">{counts.total}</span> total
          <span className="text-emerald">{counts.ok}</span> ok
          {counts.failed > 0 && <span className="text-warning-red">{counts.failed} failed</span>}
          {counts.pending > 0 && <span className="text-aether-blue animate-pulse">{counts.pending} pending</span>}
          {counts.combo > 0 && <span className="text-amethyst">{counts.combo} combo</span>}
        </div>
        <div className="w-px h-4 bg-charcoal-grey" />
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-fog-grey">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model, provider, account..."
            className="w-full h-7 pl-9 pr-3 rounded-[6px] border border-charcoal-grey bg-deep-slate text-[12px] text-porcelain placeholder:text-fog-grey focus:outline-none focus:border-porcelain/30 transition-colors duration-100"
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {[
            { key: "all", label: "All" },
            { key: "ok", label: "Success" },
            { key: "failed", label: "Failed" },
            { key: "pending", label: "Pending" },
            { key: "combo", label: "Combo" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={cn(
                "h-6 px-2.5 rounded-[4px] text-[11px] font-[510] transition-colors duration-100",
                filterStatus === f.key
                  ? "bg-porcelain/10 text-porcelain border border-porcelain/20"
                  : "text-fog-grey hover:text-storm-cloud hover:bg-deep-slate border border-transparent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Provider filter */}
        {providers.length > 0 && (
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="h-7 px-2 rounded-[6px] border border-charcoal-grey bg-deep-slate text-[12px] text-porcelain focus:outline-none focus:border-porcelain/30 transition-colors duration-100"
          >
            <option value="all">All Providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-[6px] border border-charcoal-grey overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-fog-grey">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Loading logs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="material-symbols-outlined text-[28px] text-fog-grey">receipt_long</span>
              <p className="text-[12px] text-fog-grey">
                {logs.length === 0 ? "No logs recorded yet." : "No logs match your filters."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap text-[12px]">
              <thead className="sticky top-0 z-10 bg-pitch-black border-b border-charcoal-grey">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Time
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Model
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Provider
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Account
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey text-right">
                    In
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey text-right">
                    Out
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey border-r border-charcoal-grey">
                    Status
                  </th>
                  <th className="px-3 py-2 text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey">Combo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  const isFailed = log.status?.includes("FAILED");
                  const isPending = log.status?.includes("PENDING");

                  return (
                    <tr
                      key={log.id}
                      onClick={() => (isSelected ? closeDetail() : openDetail(log))}
                      className={cn(
                        "border-b border-charcoal-grey/50 last:border-0 cursor-pointer transition-colors duration-100",
                        isPending && "bg-aether-blue/5",
                        isFailed && !isPending && "bg-warning-red/5",
                        isSelected && "bg-porcelain/5 ring-1 ring-inset ring-porcelain/10",
                        !isSelected && !isPending && !isFailed && "hover:bg-deep-slate",
                      )}
                    >
                      <td className="px-3 py-2 border-r border-charcoal-grey/50 text-fog-grey font-mono text-[11px]">
                        {log.timestamp}
                      </td>
                      <td
                        className="px-3 py-2 border-r border-charcoal-grey/50 text-porcelain font-mono max-w-[200px] truncate"
                        title={log.model}
                      >
                        {log.model}
                      </td>
                      <td className="px-3 py-2 border-r border-charcoal-grey/50">
                        <ProviderBadge provider={log.provider} />
                      </td>
                      <td
                        className="px-3 py-2 border-r border-charcoal-grey/50 text-storm-cloud max-w-[140px] truncate"
                        title={log.account}
                      >
                        {log.account || "—"}
                      </td>
                      <td className="px-3 py-2 border-r border-charcoal-grey/50 text-right text-aether-blue font-mono">
                        {fmtTokens(log.promptTokens)}
                      </td>
                      <td className="px-3 py-2 border-r border-charcoal-grey/50 text-right text-emerald font-mono">
                        {fmtTokens(log.completionTokens)}
                      </td>
                      <td className="px-3 py-2 border-r border-charcoal-grey/50">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-3 py-2">
                        <ComboBadge combo={log.combo} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-[10px] text-fog-grey italic">
        Showing {filtered.length} of {counts.total} logs · Polling every 3s when live
      </p>

      {/* Detail Drawer */}
      <RequestLogDetail log={selectedLog} detail={detailData} loading={detailLoading} onClose={closeDetail} />
    </div>
  );
}
