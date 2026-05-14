"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/shared/utils/cn";
import { LogDrawer, LogDrawerHeader, LogDrawerBody, DetailSection, DetailRow, JsonBlock } from "./LogDrawer";

const fmtTokens = (n) => {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

function parseLog(raw) {
  const parts = raw.split(" | ");
  if (parts.length < 7) return null;
  return {
    raw,
    timestamp: parts[0],
    model: parts[1],
    provider: parts[2],
    account: parts[3],
    promptTokens: parts[4],
    completionTokens: parts[5],
    status: parts[6]?.trim(),
    combo: parts[7]?.trim() && parts[7].trim() !== "-" ? parts[7].trim() : null,
  };
}

function StatusBadge({ status }) {
  if (!status) return null;
  const isPending = status.includes("PENDING");
  const isFailed = status.includes("FAILED");
  const isOk = status.includes("OK");
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

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function LogDetailDrawer({ log, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!log) return;
    setDetail(null);
    // Try to fetch detail from request-details API by matching timestamp+model
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ model: log.model, pageSize: 5 });
        const res = await fetch(`/api/usage/request-details?${params}`);
        if (res.ok) {
          const json = await res.json();
          // Find best match by model
          const match = json.details?.find((d) => d.model === log.model) ?? json.details?.[0];
          if (match) setDetail(match);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [log]);

  if (!log) return null;

  const isOk = log.status?.includes("OK");
  const isFailed = log.status?.includes("FAILED");

  return (
    <LogDrawer open={!!log} onClose={onClose}>
      <LogDrawerHeader title="Request Detail" onClose={onClose} />
      <LogDrawerBody>
        {/* Summary */}
        <DetailSection title="Summary" icon="info">
          <DetailRow label="Timestamp" value={log.timestamp} mono />
          <DetailRow label="Model" value={log.model} mono accent="text-porcelain" />
          <DetailRow label="Provider" value={log.provider} />
          <DetailRow label="Account" value={log.account} />
          <DetailRow
            label="Status"
            value={
              <span
                className={cn(
                  "text-[11px] font-[590]",
                  isOk && "text-emerald",
                  isFailed && "text-warning-red",
                  !isOk && !isFailed && "text-aether-blue",
                )}
              >
                {log.status}
              </span>
            }
          />
          <DetailRow label="Combo" value={log.combo} accent="text-amethyst" />
        </DetailSection>

        {/* Tokens */}
        <DetailSection title="Tokens" icon="token">
          <DetailRow label="Input tokens" value={log.promptTokens !== "-" ? log.promptTokens : null} mono />
          <DetailRow label="Output tokens" value={log.completionTokens !== "-" ? log.completionTokens : null} mono />
        </DetailSection>

        {/* Detail from DB */}
        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-fog-grey">
            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
            Loading detail...
          </div>
        )}

        {detail && (
          <>
            {/* Latency */}
            {detail.latency && Object.keys(detail.latency).length > 0 && (
              <DetailSection title="Latency" icon="speed">
                {detail.latency.total != null && <DetailRow label="Total" value={`${detail.latency.total}ms`} mono />}
                {detail.latency.ttfb != null && <DetailRow label="TTFB" value={`${detail.latency.ttfb}ms`} mono />}
              </DetailSection>
            )}

            {/* Request */}
            {detail.request && Object.keys(detail.request).length > 0 && (
              <DetailSection title="Client Request" icon="upload">
                <JsonBlock data={detail.request} />
              </DetailSection>
            )}

            {/* Provider Request */}
            {detail.providerRequest && Object.keys(detail.providerRequest).length > 0 && (
              <DetailSection title="Provider Request" icon="send">
                <JsonBlock data={detail.providerRequest} />
              </DetailSection>
            )}

            {/* Provider Response */}
            {detail.providerResponse && Object.keys(detail.providerResponse).length > 0 && (
              <DetailSection title="Provider Response" icon="download">
                <JsonBlock data={detail.providerResponse} />
              </DetailSection>
            )}

            {/* Client Response */}
            {detail.response && Object.keys(detail.response).length > 0 && (
              <DetailSection title="Client Response" icon="output">
                <JsonBlock data={detail.response} />
              </DetailSection>
            )}
          </>
        )}

        {!loading && !detail && (
          <div className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-4 text-center">
            <span className="material-symbols-outlined text-[20px] text-fog-grey mb-2">info</span>
            <p className="text-[12px] text-fog-grey">No detailed payload available for this request.</p>
            <p className="text-[11px] text-fog-grey/60 mt-1">
              Enable detailed logging in Settings to capture request/response payloads.
            </p>
          </div>
        )}
      </LogDrawerBody>
    </LogDrawer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RequestLogger() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const prevSigRef = useRef("");

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/usage/request-logs");
      if (!res.ok) return;
      const data = await res.json();
      const sig = JSON.stringify(data.slice(0, 20).map((l) => l.slice(0, 40)));
      if (sig === prevSigRef.current) return;
      prevSigRef.current = sig;
      setLogs(data);
    } catch {
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => fetchLogs(false), 3000);
    return () => clearInterval(t);
  }, [recording, fetchLogs]);

  const parsed = logs.map(parseLog).filter(Boolean);

  // Unique providers for filter
  const providers = [...new Set(parsed.map((l) => l.provider).filter((p) => p && p !== "-"))];

  const filtered = parsed.filter((l) => {
    if (filterStatus === "ok" && !l.status?.includes("OK")) return false;
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

  const counts = {
    total: parsed.length,
    ok: parsed.filter((l) => l.status?.includes("OK")).length,
    failed: parsed.filter((l) => l.status?.includes("FAILED")).length,
    pending: parsed.filter((l) => l.status?.includes("PENDING")).length,
    combo: parsed.filter((l) => l.combo).length,
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[14px] font-[510] text-porcelain tracking-[-0.13px]">Request Logs</h2>
          <div className="flex items-center gap-2 text-[11px] text-fog-grey">
            <span className="text-storm-cloud">{counts.total}</span> total
            <span className="text-emerald">{counts.ok}</span> ok
            {counts.failed > 0 && <span className="text-warning-red">{counts.failed}</span>}
            {counts.pending > 0 && <span className="text-aether-blue animate-pulse">{counts.pending}</span>}
            {counts.combo > 0 && <span className="text-amethyst">{counts.combo} combo</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(false)}
            className="flex items-center justify-center size-7 rounded-[4px] border border-charcoal-grey text-storm-cloud hover:bg-deep-slate hover:text-porcelain transition-colors duration-100"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
          </button>
          <button
            onClick={() => setRecording((v) => !v)}
            title={recording ? "Pause recording" : "Resume recording"}
            className={cn(
              "flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] border text-[11px] font-[510] transition-colors duration-100",
              recording
                ? "border-warning-red/30 bg-warning-red/8 text-warning-red hover:bg-warning-red/15"
                : "border-charcoal-grey text-storm-cloud hover:bg-deep-slate hover:text-porcelain",
            )}
          >
            <span className={cn("size-1.5 rounded-full", recording ? "bg-warning-red animate-pulse" : "bg-fog-grey")} />
            {recording ? "Live" : "Paused"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
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
            className="w-full h-7 pl-7 pr-3 rounded-[6px] border border-charcoal-grey bg-deep-slate text-[12px] text-porcelain placeholder:text-fog-grey focus:outline-none focus:border-porcelain/30 transition-colors duration-100"
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {[
            { key: "all", label: "All" },
            { key: "ok", label: "OK" },
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
                {filtered.map((log, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelected(log)}
                    className={cn(
                      "border-b border-charcoal-grey/50 last:border-0 cursor-pointer transition-colors duration-100",
                      log.status?.includes("PENDING") ? "bg-aether-blue/5" : "hover:bg-deep-slate",
                      selected?.raw === log.raw && "bg-porcelain/5",
                    )}
                  >
                    <td className="px-3 py-2 border-r border-charcoal-grey/50 text-fog-grey font-mono">
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-[10px] text-fog-grey italic">
        Showing {filtered.length} of {counts.total} logs · Polling every 3s when live
      </p>

      {/* Detail Drawer */}
      <LogDetailDrawer log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
