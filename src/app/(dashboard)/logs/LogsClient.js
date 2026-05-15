"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { cn } from "@/shared/utils/cn";
import RequestLogger from "@/shared/components/RequestLogger";
import ConsoleLogClient from "./ConsoleLogClient";
import ProxyLogsTab from "./ProxyLogsTab";

const TABS = [
  { key: "request-logs", label: "Request Logs", icon: "receipt_long" },
  { key: "proxy-logs", label: "Proxy Logs", icon: "lan" },
  { key: "console", label: "Console Logs", icon: "terminal" },
];

function RequestLogsToolbar({ sortBy, setSortBy, onRefresh, recording, setRecording }) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        className="h-7 px-2 rounded-[6px] border border-charcoal-grey bg-deep-slate text-[12px] text-porcelain focus:outline-none focus:border-porcelain/30 transition-colors duration-100"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="tokens_desc">Most tokens</option>
        <option value="tokens_asc">Fewest tokens</option>
      </select>
      <button
        onClick={onRefresh}
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
            ? "border-emerald/30 bg-emerald/8 text-emerald hover:bg-emerald/15"
            : "border-charcoal-grey text-storm-cloud hover:bg-deep-slate hover:text-porcelain",
        )}
      >
        <span className={cn("size-1.5 rounded-full", recording ? "bg-emerald animate-pulse" : "bg-fog-grey")} />
        {recording ? "Live" : "Paused"}
      </button>
    </div>
  );
}

function LogsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") || "request-logs";

  // Lifted state for RequestLogger toolbar
  const [sortBy, setSortBy] = useState("newest");
  const [recording, setRecording] = useState(true);
  const refreshRef = useRef(null);

  const setTab = (key) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Page header: tabs left, toolbar right */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Pill tabs */}
        <div className="flex items-center gap-1 p-1 rounded-[8px] bg-graphite border border-charcoal-grey">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded-[6px] text-[12px] font-[510] transition-colors duration-100",
                activeTab === tab.key
                  ? "bg-deep-slate text-porcelain shadow-[var(--shadow-sm)]"
                  : "text-fog-grey hover:text-storm-cloud hover:bg-deep-slate/50",
              )}
            >
              <span className="material-symbols-outlined text-[13px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar — only for request-logs tab */}
        {activeTab === "request-logs" && (
          <RequestLogsToolbar
            sortBy={sortBy}
            setSortBy={setSortBy}
            onRefresh={() => refreshRef.current?.()}
            recording={recording}
            setRecording={setRecording}
          />
        )}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "request-logs" && (
          <RequestLogger
            sortBy={sortBy}
            setSortBy={setSortBy}
            recording={recording}
            setRecording={setRecording}
            refreshRef={refreshRef}
          />
        )}
        {activeTab === "proxy-logs" && <ProxyLogsTab />}
        {activeTab === "console" && <ConsoleLogClient />}
      </div>
    </div>
  );
}

export default function LogsClient() {
  return (
    <Suspense fallback={<div className="text-[12px] text-fog-grey">Loading...</div>}>
      <LogsInner />
    </Suspense>
  );
}
