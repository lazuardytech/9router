"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/shared/utils/cn";
import RequestLogger from "@/shared/components/RequestLogger";
import ConsoleLogClient from "./ConsoleLogClient";
import ProxyLogsTab from "./ProxyLogsTab";

const TABS = [
  { key: "request-logs", label: "Request Logs", icon: "receipt_long" },
  { key: "proxy-logs", label: "Proxy Logs", icon: "lan" },
  { key: "console", label: "Console Logs", icon: "terminal" },
];

function LogsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") || "request-logs";

  const setTab = (key) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Page header: active tab title left, tabs right */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {TABS.find((t) => t.key === activeTab) && (
            <>
              <span className="material-symbols-outlined text-storm-cloud text-[16px]">
                {TABS.find((t) => t.key === activeTab).icon}
              </span>
              <h1 className="text-[14px] font-[510] text-porcelain tracking-[-0.13px] mt-0.5">
                {TABS.find((t) => t.key === activeTab).label}
              </h1>
            </>
          )}
        </div>

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
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "request-logs" && <RequestLogger />}
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
