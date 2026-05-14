"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { ConfirmModal } from "./Modal";

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "tts", "stt"];
const COMBINED_WEB_ITEM = {
  id: "web",
  label: "Web Fetch & Search",
  icon: "travel_explore",
  href: "/dashboard/media-providers/web",
};

const apiItems = [
  { href: "/dashboard/endpoint", label: "Endpoint", icon: "api" },
  { href: "/dashboard/providers", label: "LLM Providers", icon: "dns" },
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
  { href: "/dashboard/memory", label: "Memory", icon: "memory_alt" },
  { href: "/dashboard/cache", label: "Cache", icon: "cached" },
];

const analyticsItems = [
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Quota", icon: "data_usage" },
];

const debugItems = [{ href: "/dashboard/console-log", label: "Console Log", icon: "terminal" }];

const systemItems = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/profile", label: "Settings", icon: "settings" },
];

function NavSection({ label, children }) {
  return (
    <div className="pt-4 first:pt-0">
      <p className="px-3 mb-1 text-[10px] font-[590] text-fog-grey uppercase tracking-[0.06em]">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({ href, label, icon, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-[2px] transition-colors duration-100 group",
        active ? "bg-porcelain/8 text-porcelain" : "text-storm-cloud hover:bg-deep-slate hover:text-porcelain",
      )}
    >
      <span
        className={cn(
          "material-symbols-outlined text-[15px] shrink-0",
          active ? "text-porcelain" : "text-fog-grey group-hover:text-storm-cloud",
        )}
      >
        {icon}
      </span>
      <span className="text-[13px] font-[400] tracking-[-0.12px] truncate">{label}</span>
    </Link>
  );
}

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);

  const isActive = (href) => {
    if (href === "/dashboard/endpoint") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    }
    return pathname.startsWith(href);
  };

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try {
      await fetch("/api/shutdown", { method: "POST" });
    } catch {}
    setIsShuttingDown(false);
    setShowShutdownModal(false);
    setIsDisconnected(true);
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      await fetch("/api/restart", { method: "POST" });
    } catch {}
    setTimeout(() => globalThis.location.reload(), 3000);
  };

  return (
    <>
      <aside className="flex w-60 flex-col border-r border-charcoal-grey bg-graphite min-h-full">
        {/* Logo */}
        <div className="px-4 py-3 border-b border-charcoal-grey">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="flex items-center justify-center size-7 rounded-[6px] bg-porcelain shadow-[var(--shadow-sm)]">
              <span className="material-symbols-outlined text-pitch-black text-[16px]">hub</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-[510] text-porcelain tracking-[-0.12px] leading-none">
                {APP_CONFIG.name}
              </span>
              <span className="text-[10px] text-fog-grey leading-none mt-0.5">v{APP_CONFIG.displayVersion}</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto custom-scrollbar space-y-0">
          <NavSection label="API">
            <NavItem {...apiItems[0]} active={isActive(apiItems[0].href)} onClick={onClose} />
            <NavItem {...apiItems[1]} active={isActive(apiItems[1].href)} onClick={onClose} />

            {/* Media Providers accordion */}
            <button
              onClick={() => setMediaOpen((v) => !v)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[2px] transition-colors duration-100 group",
                pathname.startsWith("/dashboard/media-providers")
                  ? "bg-porcelain/8 text-porcelain"
                  : "text-storm-cloud hover:bg-deep-slate hover:text-porcelain",
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[15px] shrink-0",
                  pathname.startsWith("/dashboard/media-providers")
                    ? "text-porcelain"
                    : "text-fog-grey group-hover:text-storm-cloud",
                )}
              >
                perm_media
              </span>
              <span className="text-[13px] font-[400] tracking-[-0.12px] flex-1 text-left truncate">
                Media Providers
              </span>
              <span
                className="material-symbols-outlined text-[13px] text-fog-grey transition-transform duration-150"
                style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                expand_more
              </span>
            </button>

            {mediaOpen && (
              <div className="pl-3 space-y-0.5">
                {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((kind) => (
                  <Link
                    key={kind.id}
                    href={`/dashboard/media-providers/${kind.id}`}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-[2px] transition-colors duration-100",
                      pathname.startsWith(`/dashboard/media-providers/${kind.id}`)
                        ? "text-porcelain"
                        : "text-fog-grey hover:bg-deep-slate hover:text-storm-cloud",
                    )}
                  >
                    <span className="material-symbols-outlined text-[13px]">{kind.icon}</span>
                    <span className="text-[12px] tracking-[-0.1px]">{kind.label}</span>
                  </Link>
                ))}
                <Link
                  href={COMBINED_WEB_ITEM.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-[2px] transition-colors duration-100",
                    pathname.startsWith(COMBINED_WEB_ITEM.href)
                      ? "text-porcelain"
                      : "text-fog-grey hover:bg-deep-slate hover:text-storm-cloud",
                  )}
                >
                  <span className="material-symbols-outlined text-[13px]">{COMBINED_WEB_ITEM.icon}</span>
                  <span className="text-[12px] tracking-[-0.1px]">{COMBINED_WEB_ITEM.label}</span>
                </Link>
              </div>
            )}

            {apiItems.slice(2).map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} onClick={onClose} />
            ))}
          </NavSection>

          <NavSection label="Analytics">
            {analyticsItems.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} onClick={onClose} />
            ))}
          </NavSection>

          <NavSection label="System">
            {systemItems.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} onClick={onClose} />
            ))}
            {debugItems.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} onClick={onClose} />
            ))}
          </NavSection>
        </nav>

        {/* Footer actions */}
        <div className="flex items-center gap-1.5 p-2 border-t border-charcoal-grey">
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-[6px] border border-charcoal-grey text-storm-cloud hover:bg-deep-slate hover:text-porcelain disabled:opacity-40 transition-colors duration-100 text-[12px]"
          >
            {isRestarting ? (
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            )}
            Restart
          </button>
          <button
            onClick={() => setShowShutdownModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-[6px] border border-charcoal-grey text-storm-cloud hover:bg-warning-red/10 hover:border-warning-red/30 hover:text-warning-red transition-colors duration-100 text-[12px]"
          >
            <span className="material-symbols-outlined text-[14px]">power_settings_new</span>
            Shutdown
          </button>
        </div>
      </aside>

      <ConfirmModal
        isOpen={showShutdownModal}
        onClose={() => setShowShutdownModal(false)}
        onConfirm={handleShutdown}
        title="Shutdown Server"
        message="Are you sure you want to stop the proxy server?"
        confirmText="Shutdown"
        cancelText="Cancel"
        variant="danger"
        loading={isShuttingDown}
      />

      {isDisconnected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pitch-black/90 backdrop-blur-sm p-6">
          <div className="text-center p-8">
            <div className="flex items-center justify-center size-12 rounded-full bg-warning-red/10 text-warning-red mx-auto mb-4">
              <span className="material-symbols-outlined text-[24px]">power_off</span>
            </div>
            <h2 className="text-[15px] font-[510] text-porcelain mb-1.5 tracking-[-0.13px]">Server Disconnected</h2>
            <p className="text-[13px] text-storm-cloud mb-5">The proxy server has been stopped.</p>
            <button
              onClick={() => globalThis.location.reload()}
              className="h-8 px-4 rounded-[6px] bg-gunmetal border border-charcoal-grey text-[13px] text-porcelain hover:bg-deep-slate transition-colors duration-100"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};
