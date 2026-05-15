"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config";
import { cn } from "@/shared/utils/cn";

const LEVEL_RE = /\[(LOG|INFO|WARN|ERROR|DEBUG)\]/i;

const LEVEL_STYLES = {
  LOG: { badge: "bg-emerald/10 text-emerald border-emerald/20", text: "text-emerald" },
  INFO: { badge: "bg-aether-blue/10 text-aether-blue border-aether-blue/20", text: "text-aether-blue" },
  WARN: { badge: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20", text: "text-[#f59e0b]" },
  ERROR: { badge: "bg-warning-red/10 text-warning-red border-warning-red/20", text: "text-warning-red" },
  DEBUG: { badge: "bg-amethyst/10 text-amethyst border-amethyst/20", text: "text-amethyst" },
};

const LEVEL_ORDER = { DEBUG: 0, LOG: 1, INFO: 2, WARN: 3, ERROR: 4 };

function parseLevel(line) {
  const m = line.match(LEVEL_RE);
  return m ? m[1].toUpperCase() : "LOG";
}

function parseTimestamp(line) {
  // Match [HH:MM:SS] or [YYYY-MM-DD HH:MM:SS] at start
  const m = line.match(/^\[(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/);
  return m ? m[1] : null;
}

function stripLevel(line) {
  return line.replace(LEVEL_RE, "").trim();
}

function LogLine({ line, idx, onCopy, copied }) {
  const level = parseLevel(line);
  const ts = parseTimestamp(line);
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.LOG;
  const text = stripLevel(line);

  return (
    <div
      className={cn(
        "group flex items-start gap-2 px-3 py-1 rounded-[4px] hover:bg-porcelain/4 transition-colors duration-75",
      )}
    >
      {/* Timestamp */}
      <span className="shrink-0 text-[10px] text-fog-grey font-mono mt-0.5 w-[72px]">{ts || "—"}</span>

      {/* Level badge */}
      <span
        className={cn(
          "shrink-0 inline-flex items-center px-1 py-0.5 rounded-[3px] border text-[9px] font-[590] uppercase tracking-[0.05em] mt-0.5 w-[42px] justify-center",
          style.badge,
        )}
      >
        {level}
      </span>

      {/* Message */}
      <span className={cn("flex-1 text-[11px] font-mono leading-[1.6] break-all", style.text)}>{text}</span>

      {/* Copy button */}
      <button
        onClick={() => onCopy(line, idx)}
        className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center size-5 rounded-[3px] text-fog-grey hover:text-porcelain hover:bg-deep-slate transition-all duration-100"
        title="Copy line"
      >
        <span className="material-symbols-outlined text-[12px]">{copied === idx ? "check" : "content_copy"}</span>
      </button>
    </div>
  );
}

export default function ConsoleLogClient() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [levelFilter, setLevelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const scrollRef = useRef(null);
  const esRef = useRef(null);

  const handleClear = async () => {
    try {
      await fetch("/api/translator/console-logs", { method: "DELETE" });
    } catch {}
  };

  const handleCopy = useCallback((line, idx) => {
    navigator.clipboard?.writeText(line).catch(() => {});
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource("/api/translator/console-logs/stream");
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setInitialized(true);
      setLastUpdated(new Date());
    };

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "init") {
        setLogs(msg.logs.slice(-CONSOLE_LOG_CONFIG.maxLines));
        setLastUpdated(new Date());
      } else if (msg.type === "line") {
        setLogs((prev) => {
          const next = [...prev, msg.line];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
        setLastUpdated(new Date());
      } else if (msg.type === "clear") {
        setLogs([]);
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter
  const filtered = logs.filter((line) => {
    const level = parseLevel(line);
    if (levelFilter !== "all") {
      const minOrder = LEVEL_ORDER[levelFilter.toUpperCase()] ?? 0;
      if ((LEVEL_ORDER[level] ?? 0) < minOrder) return false;
    }
    if (search) {
      return line.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const counts = {
    total: logs.length,
    error: logs.filter((l) => parseLevel(l) === "ERROR").length,
    warn: logs.filter((l) => parseLevel(l) === "WARN").length,
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-140px)]">
      {/* Row 1: Auto-scroll + Clear (right-aligned, sejajar tab switcher) */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll((v) => !v)}
          title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
          className={cn(
            "flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] border text-[11px] font-[510] transition-colors duration-100",
            autoScroll
              ? "border-aether-blue/30 bg-aether-blue/8 text-aether-blue"
              : "border-charcoal-grey text-fog-grey hover:bg-deep-slate hover:text-porcelain",
          )}
        >
          <span className="material-symbols-outlined text-[13px]">vertical_align_bottom</span>
          Auto-scroll
        </button>
        {/* Clear */}
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] border border-charcoal-grey text-[11px] text-storm-cloud hover:bg-warning-red/8 hover:border-warning-red/30 hover:text-warning-red transition-colors duration-100"
        >
          <span className="material-symbols-outlined text-[13px]">delete</span>
          Clear
        </button>
      </div>

      {/* Row 2: Search + Level filter + Stats */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Level filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="h-7 px-2 rounded-[6px] border border-charcoal-grey bg-deep-slate text-[12px] text-porcelain focus:outline-none focus:border-porcelain/30 transition-colors duration-100"
        >
          <option value="all">All Levels</option>
          <option value="DEBUG">Debug+</option>
          <option value="INFO">Info+</option>
          <option value="WARN">Warn+</option>
          <option value="ERROR">Error only</option>
        </select>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px] text-fog-grey">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="h-7 pl-7 pr-3 w-48 rounded-[6px] border border-charcoal-grey bg-deep-slate text-[12px] text-porcelain placeholder:text-fog-grey focus:outline-none focus:border-porcelain/30 transition-colors duration-100"
          />
        </div>

        <div className="w-px h-4 bg-charcoal-grey" />

        {/* Connection status + Stats */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span
            className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-emerald animate-pulse" : initialized ? "bg-warning-red" : "bg-[#f59e0b] animate-pulse",
            )}
          />
          <span className={connected ? "text-emerald" : initialized ? "text-warning-red" : "text-[#f59e0b]"}>
            {connected ? "Connected" : initialized ? "Disconnected" : "Connecting..."}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-fog-grey">
          <span>{counts.total} lines</span>
          {counts.error > 0 && <span className="text-warning-red">{counts.error} errors</span>}
          {counts.warn > 0 && <span className="text-[#f59e0b]">{counts.warn} warnings</span>}
          {lastUpdated && <span className="text-fog-grey/60">{lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 rounded-[6px] border border-charcoal-grey bg-pitch-black overflow-hidden flex flex-col">
        {/* Terminal header bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-charcoal-grey bg-graphite shrink-0">
          <span className="text-[11px] text-fog-grey font-mono">console — pod</span>
          <span className="ml-auto text-[10px] text-fog-grey">
            {filtered.length} / {logs.length} lines
          </span>
        </div>

        {/* Log lines */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar py-2"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            if (!atBottom && autoScroll) setAutoScroll(false);
          }}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-fog-grey">
              <span className="material-symbols-outlined text-[28px]">terminal</span>
              <p className="text-[12px]">
                {logs.length === 0 ? "No console logs yet." : "No logs match your filters."}
              </p>
            </div>
          ) : (
            filtered.map((line, i) => <LogLine key={i} line={line} idx={i} onCopy={handleCopy} copied={copied} />)
          )}
        </div>
      </div>
    </div>
  );
}
