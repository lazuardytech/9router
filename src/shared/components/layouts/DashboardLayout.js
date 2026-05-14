"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/store/notificationStore";
import { cn } from "@/shared/utils/cn";
import Sidebar from "../Sidebar";
import Header from "../Header";

function getToastStyle(type) {
  if (type === "success") return { wrapper: "border-emerald/30 bg-emerald/8 text-emerald", icon: "check_circle" };
  if (type === "error") return { wrapper: "border-warning-red/30 bg-warning-red/8 text-warning-red", icon: "error" };
  if (type === "warning") return { wrapper: "border-yellow-500/30 bg-yellow-500/8 text-yellow-400", icon: "warning" };
  return { wrapper: "border-aether-blue/30 bg-aether-blue/8 text-aether-blue", icon: "info" };
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  const isChat = pathname === "/basic-chat";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-pitch-black">
      {/* Toast notifications */}
      <div className="fixed top-3 right-3 z-[80] flex w-[min(92vw,360px)] flex-col gap-1.5">
        {notifications.map((n) => {
          const style = getToastStyle(n.type);
          return (
            <div
              key={n.id}
              className={cn(
                "rounded-[6px] border px-3 py-2 shadow-[var(--shadow-xl)] backdrop-blur-sm fade-in",
                style.wrapper,
              )}
            >
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[15px] leading-5 shrink-0">{style.icon}</span>
                <div className="min-w-0 flex-1">
                  {n.title && <p className="text-[12px] font-[510] mb-0.5 tracking-[-0.1px]">{n.title}</p>}
                  <p className="text-[12px] text-light-steel whitespace-pre-wrap break-words leading-[1.5]">
                    {n.message}
                  </p>
                </div>
                {n.dismissible && (
                  <button
                    type="button"
                    onClick={() => removeNotification(n.id)}
                    className="text-current/60 hover:text-current transition-colors shrink-0"
                    aria-label="Dismiss"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — Desktop */}
      <div className={cn("hidden lg:flex transition-all duration-200", sidebarCollapsed ? "w-14" : "w-60")}>
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
      </div>

      {/* Sidebar — Mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <main className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <Header
          key={pathname}
          onMenuClick={() => setSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        />
        <div
          className={cn(
            "flex-1 overflow-y-auto custom-scrollbar",
            isChat ? "flex flex-col overflow-hidden" : "p-4 lg:p-6",
          )}
        >
          <div className={cn(isChat ? "flex-1 w-full h-full flex flex-col" : "max-w-7xl mx-auto")}>{children}</div>
        </div>
      </main>
    </div>
  );
}
