"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProviderIcon from "@/shared/components/ProviderIcon";
import Toggle from "@/shared/components/Toggle";
import { parseQuotaData, calculatePercentage, getStatusColor, formatResetTime } from "./utils";
import { EditConnectionModal } from "@/shared/components";
import { ConfirmModal } from "@/shared/components/Modal";
import { USAGE_SUPPORTED_PROVIDERS, USAGE_APIKEY_PROVIDERS } from "@/shared/constants/providers";

// Connection is eligible for the quota page when it uses OAuth or is an apikey provider whitelisted for quota
const isUsageEligible = (conn) =>
  USAGE_SUPPORTED_PROVIDERS.includes(conn.provider) &&
  (conn.authType === "oauth" || USAGE_APIKEY_PROVIDERS.includes(conn.provider));

const REFRESH_INTERVAL_MS = 60000; // 60 seconds
const DEPLETED_QUOTA_THRESHOLD = 5; // percent
const AUTO_REFRESH_STORAGE_KEY = "quotaAutoRefresh";
const QUOTA_CACHE_KEY = "providerQuotaCache";
const QUOTA_CACHE_TTL_MS = 300000; // 5 minutes cache TTL

export default function ProviderLimits() {
  const [connections, setConnections] = useState([]);
  const [quotaData, setQuotaData] = useState(() => {
    if (typeof window === "undefined") return {};
    const cached = window.localStorage.getItem(QUOTA_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < QUOTA_CACHE_TTL_MS) return data;
    }
    return {};
  });
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [lastUpdated, setLastUpdated] = useState(() => {
    if (typeof window === "undefined") return null;
    const cached = window.localStorage.getItem(QUOTA_CACHE_KEY);
    if (cached) {
      const { timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < QUOTA_CACHE_TTL_MS) return new Date(timestamp);
    }
    return null;
  });
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [proxyPools, setProxyPools] = useState([]);
  const [providerFilter, setProviderFilter] = useState("all");
  const [expiringFirst, setExpiringFirst] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [bulkToggling, setBulkToggling] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
    variant: "default",
  });
  const openConfirm = (title, message, onConfirm, variant = "default") =>
    setConfirmDialog({ open: true, title, message, onConfirm, variant });
  const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }));

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Sync cache
  useEffect(() => {
    if (Object.keys(quotaData).length > 0) {
      window.localStorage.setItem(QUOTA_CACHE_KEY, JSON.stringify({ data: quotaData, timestamp: Date.now() }));
    }
  }, [quotaData]);

  // Fetch all provider connections
  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/providers/client");
      if (!response.ok) throw new Error("Failed to fetch connections");

      const data = await response.json();
      const connectionList = data.connections || [];
      setConnections(connectionList);
      return connectionList;
    } catch (error) {
      console.error("Error fetching connections:", error);
      setConnections([]);
      return [];
    }
  }, []);

  // Fetch quota for a specific connection
  const fetchQuota = useCallback(async (connectionId, provider) => {
    setLoading((prev) => ({ ...prev, [connectionId]: true }));
    setErrors((prev) => ({ ...prev, [connectionId]: null }));

    try {
      console.log(`[ProviderLimits] Fetching quota for ${provider} (${connectionId})`);
      const response = await fetch(`/api/usage/${connectionId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || response.statusText;

        // Handle different error types gracefully
        if (response.status === 404) {
          // Connection not found - skip silently
          console.warn(`[ProviderLimits] Connection not found for ${provider}, skipping`);
          return;
        }

        if (response.status === 401) {
          // Auth error - show message instead of throwing
          console.warn(`[ProviderLimits] Auth error for ${provider}:`, errorMsg);
          setQuotaData((prev) => ({
            ...prev,
            [connectionId]: {
              quotas: [],
              message: errorMsg,
            },
          }));
          return;
        }

        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
      }

      const data = await response.json();
      console.log(`[ProviderLimits] Got quota for ${provider}:`, data);

      // Parse quota data using provider-specific parser
      const parsedQuotas = parseQuotaData(provider, data);

      setQuotaData((prev) => ({
        ...prev,
        [connectionId]: {
          quotas: parsedQuotas,
          plan: data.plan || null,
          message: data.message || null,
          raw: data,
        },
      }));
    } catch (error) {
      console.error(`[ProviderLimits] Error fetching quota for ${provider} (${connectionId}):`, error);
      setErrors((prev) => ({
        ...prev,
        [connectionId]: error.message || "Failed to fetch quota",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [connectionId]: false }));
    }
  }, []);

  // Refresh quota for a specific provider
  const refreshProvider = useCallback(
    async (connectionId, provider) => {
      await fetchQuota(connectionId, provider);
      setLastUpdated(new Date());
    },
    [fetchQuota],
  );

  const handleDeleteConnection = useCallback(async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.id !== id));
        setQuotaData((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setLoading((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch (error) {
      console.error("Error deleting connection:", error);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleToggleConnectionActive = useCallback(async (id, isActive) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
      }
    } catch (error) {
      console.error("Error updating connection status:", error);
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleUpdateConnection = useCallback(
    async (formData) => {
      if (!selectedConnection?.id) return;
      const connectionId = selectedConnection.id;
      const provider = selectedConnection.provider;
      try {
        const res = await fetch(`/api/providers/${connectionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          await fetchConnections();
          setShowEditModal(false);
          setSelectedConnection(null);
          if (USAGE_SUPPORTED_PROVIDERS.includes(provider)) {
            await fetchQuota(connectionId, provider);
          }
        }
      } catch (error) {
        console.error("Error saving connection:", error);
      }
    },
    [selectedConnection, fetchConnections, fetchQuota],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/proxy-pools?isActive=true", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.proxyPools) {
          setProxyPools(data.proxyPools);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh all providers
  const refreshAll = useCallback(async () => {
    if (refreshingAll) return;

    setRefreshingAll(true);
    setCountdown(60);

    try {
      const conns = await fetchConnections();

      // Filter eligible connections (OAuth + whitelisted apikey)
      const eligibleConnections = conns.filter(isUsageEligible);

      await Promise.all(eligibleConnections.map((conn) => fetchQuota(conn.id, conn.provider)));

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error refreshing all providers:", error);
    } finally {
      setRefreshingAll(false);
    }
  }, [refreshingAll, fetchConnections, fetchQuota]);

  // Initial load: fetch connections first so cards render immediately, then fetch quotas
  useEffect(() => {
    const initializeData = async () => {
      setConnectionsLoading(true);
      const conns = await fetchConnections();
      setConnectionsLoading(false);

      const eligibleConnections = conns.filter(isUsageEligible);

      // Mark all as loading before fetching
      const loadingState = {};
      eligibleConnections.forEach((conn) => {
        loadingState[conn.id] = true;
      });
      setLoading(loadingState);

      await Promise.all(eligibleConnections.map((conn) => fetchQuota(conn.id, conn.provider)));
      setLastUpdated(new Date());
    };

    initializeData();
  }, []);

  // Persist auto-refresh preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(autoRefresh));
  }, [autoRefresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    // Main refresh interval
    intervalRef.current = setInterval(() => {
      refreshAll();
    }, REFRESH_INTERVAL_MS);

    // Countdown interval
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, refreshAll]);

  // Pause auto-refresh when tab is hidden (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      } else if (autoRefresh) {
        // Resume auto-refresh when tab becomes visible
        intervalRef.current = setInterval(refreshAll, REFRESH_INTERVAL_MS);
        countdownRef.current = setInterval(() => {
          setCountdown((prev) => (prev <= 1 ? 60 : prev - 1));
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoRefresh, refreshAll]);

  // Filter eligible connections (OAuth + whitelisted apikey)
  const filteredConnections = connections.filter(isUsageEligible);

  const providerFilteredConnections = filteredConnections.filter(
    (conn) => providerFilter === "all" || conn.provider === providerFilter,
  );

  const getEarliestResetTime = (conn) => {
    const resetTimes = (quotaData[conn.id]?.quotas || [])
      .map((quota) => (quota.resetAt ? new Date(quota.resetAt).getTime() : Number.POSITIVE_INFINITY))
      .filter((time) => Number.isFinite(time));
    return resetTimes.length > 0 ? Math.min(...resetTimes) : Number.POSITIVE_INFINITY;
  };

  // Sort providers by USAGE_SUPPORTED_PROVIDERS order, then alphabetically.
  // Optionally surface accounts with quotas expiring soonest first.
  const sortedConnections = [...providerFilteredConnections].sort((a, b) => {
    if (expiringFirst) {
      const expiryDiff = getEarliestResetTime(a) - getEarliestResetTime(b);
      if (expiryDiff !== 0) return expiryDiff;
    }
    const orderA = USAGE_SUPPORTED_PROVIDERS.indexOf(a.provider);
    const orderB = USAGE_SUPPORTED_PROVIDERS.indexOf(b.provider);
    if (orderA !== orderB) return orderA - orderB;
    return a.provider.localeCompare(b.provider);
  });

  // Connection is depleted when any quota entry hit the threshold
  const isConnectionDepleted = (conn) => {
    const quotas = quotaData[conn.id]?.quotas;
    if (!quotas?.length) return false;
    return quotas.some((q) => {
      if (!q.total || q.total <= 0) return false;
      return calculatePercentage(q.used, q.total) <= DEPLETED_QUOTA_THRESHOLD;
    });
  };

  const bulkSetActive = useCallback(
    async (targetIds, isActive) => {
      if (!targetIds.length || bulkToggling) return;
      setBulkToggling(true);
      try {
        await Promise.all(
          targetIds.map((id) =>
            fetch(`/api/providers/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive }),
            }),
          ),
        );
        setConnections((prev) => prev.map((c) => (targetIds.includes(c.id) ? { ...c, isActive } : c)));
      } catch (error) {
        console.error("Error bulk toggling connections:", error);
      } finally {
        setBulkToggling(false);
      }
    },
    [bulkToggling],
  );

  const handleDisableDepleted = () => {
    const ids = sortedConnections.filter((c) => (c.isActive ?? true) && isConnectionDepleted(c)).map((c) => c.id);
    bulkSetActive(ids, false);
  };

  const handleEnableAvailable = () => {
    const ids = sortedConnections.filter((c) => !(c.isActive ?? true) && !isConnectionDepleted(c)).map((c) => c.id);
    bulkSetActive(ids, true);
  };

  const providerOptions = Array.from(new Set(filteredConnections.map((conn) => conn.provider))).sort();
  const selectedProviderLabel = providerFilter === "all" ? "All providers" : providerFilter;

  // Calculate summary stats
  const totalProviders = sortedConnections.length;
  const activeWithLimits = Object.values(quotaData).filter((data) => data?.quotas?.length > 0).length;

  // Count low quotas (remaining < 30%)
  const lowQuotasCount = Object.values(quotaData).reduce((count, data) => {
    if (!data?.quotas) return count;

    const hasLowQuota = data.quotas.some((quota) => {
      const percentage = calculatePercentage(quota.used, quota.total);
      return percentage < 30 && quota.total > 0;
    });

    return count + (hasLowQuota ? 1 : 0);
  }, 0);

  // Accumulated progress for a connection: sum used / sum total
  const getAccumulatedProgress = (conn) => {
    const quotas = quotaData[conn.id]?.quotas || [];
    const totalUsed = quotas.reduce((s, q) => s + (q.used || 0), 0);
    const totalLimit = quotas.reduce((s, q) => s + (q.total || 0), 0);
    const pct = calculatePercentage(totalUsed, totalLimit);
    return { totalUsed, totalLimit, pct };
  };

  // Color classes from status color name
  const colorClasses = (color) => {
    if (color === "green") return { bar: "bg-green-500", track: "bg-green-500/15", text: "text-green-400" };
    if (color === "yellow") return { bar: "bg-yellow-500", track: "bg-yellow-500/15", text: "text-yellow-400" };
    return { bar: "bg-red-500", track: "bg-red-500/15", text: "text-red-400" };
  };

  // Empty state
  if (!connectionsLoading && sortedConnections.length === 0) {
    return (
      <div className="rounded-[6px] border border-charcoal-grey overflow-hidden">
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-[48px] text-storm-cloud opacity-30">cloud_off</span>
          <h3 className="mt-3 text-[13px] font-[510] text-porcelain">No Providers Connected</h3>
          <p className="mt-1 text-[11px] text-storm-cloud max-w-xs mx-auto">
            Connect to providers with OAuth to track your API quota limits and usage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Provider filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProviderMenuOpen((prev) => !prev)}
            className="h-7 px-2.5 rounded-[4px] border border-charcoal-grey text-[11px] text-storm-cloud hover:text-porcelain hover:bg-deep-slate transition-colors flex items-center gap-1.5"
            aria-haspopup="menu"
            aria-expanded={providerMenuOpen}
            title="Filter quota providers"
          >
            {providerFilter === "all" ? (
              <span className="material-symbols-outlined text-[13px]">apps</span>
            ) : (
              <ProviderIcon
                src={`/providers/${providerFilter}.png`}
                alt={providerFilter}
                size={14}
                className="size-[14px] rounded object-contain"
                fallbackText={providerFilter.slice(0, 2).toUpperCase()}
              />
            )}
            <span className="capitalize hidden lg:inline">{selectedProviderLabel}</span>
            <span className="material-symbols-outlined text-[13px]">expand_more</span>
          </button>

          {providerMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 bg-transparent"
                aria-label="Close provider filter"
                onClick={() => setProviderMenuOpen(false)}
              />
              <div className="absolute left-0 z-40 mt-1 w-52 overflow-hidden rounded-[6px] border border-charcoal-grey bg-graphite p-1 shadow-xl shadow-black/30">
                <button
                  type="button"
                  onClick={() => {
                    setProviderFilter("all");
                    setProviderMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                    providerFilter === "all"
                      ? "bg-deep-slate text-porcelain"
                      : "text-storm-cloud hover:bg-deep-slate hover:text-porcelain"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">apps</span>
                  <span>All providers</span>
                  {providerFilter === "all" && (
                    <span className="material-symbols-outlined ml-auto text-[13px]">check</span>
                  )}
                </button>
                <div className="my-1 h-px bg-charcoal-grey" />
                <div className="max-h-60 overflow-y-auto">
                  {providerOptions.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => {
                        setProviderFilter(provider);
                        setProviderMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                        providerFilter === provider
                          ? "bg-deep-slate text-porcelain"
                          : "text-storm-cloud hover:bg-deep-slate hover:text-porcelain"
                      }`}
                    >
                      <ProviderIcon
                        src={`/providers/${provider}.png`}
                        alt={provider}
                        size={16}
                        className="size-4 rounded object-contain"
                        fallbackText={provider.slice(0, 2).toUpperCase()}
                      />
                      <span className="capitalize">{provider}</span>
                      {providerFilter === provider && (
                        <span className="material-symbols-outlined ml-auto text-[13px]">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Expiring first */}
        <button
          type="button"
          onClick={() => setExpiringFirst((prev) => !prev)}
          className={`h-7 px-2.5 rounded-[4px] border text-[11px] transition-colors flex items-center gap-1 ${
            expiringFirst
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "border-charcoal-grey text-storm-cloud hover:text-porcelain hover:bg-deep-slate"
          }`}
          title="Sort accounts by earliest quota reset time"
        >
          <span className="material-symbols-outlined text-[13px]">hourglass_top</span>
          <span className="hidden sm:inline">Expiring first</span>
        </button>

        {/* Bulk: disable depleted */}
        <button
          type="button"
          onClick={handleDisableDepleted}
          disabled={bulkToggling}
          className="h-7 px-2.5 rounded-[4px] border border-red-500/30 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1 disabled:opacity-50"
          title="Disable connections with depleted quota"
        >
          <span className="material-symbols-outlined text-[13px]">block</span>
          <span className="hidden sm:inline">Turn off Empty</span>
        </button>

        {/* Bulk: enable available */}
        <button
          type="button"
          onClick={handleEnableAvailable}
          disabled={bulkToggling}
          className="h-7 px-2.5 rounded-[4px] border border-emerald-500/30 text-[11px] text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 disabled:opacity-50"
          title="Enable connections that still have quota"
        >
          <span className="material-symbols-outlined text-[13px]">check_circle</span>
          <span className="hidden sm:inline">Turn on Available</span>
        </button>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh((prev) => !prev)}
          className="h-7 px-2.5 rounded-[4px] border border-charcoal-grey text-[11px] text-storm-cloud hover:text-porcelain hover:bg-deep-slate transition-colors flex items-center gap-1"
          title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
        >
          <span
            className={`material-symbols-outlined text-[13px] ${autoRefresh ? "text-aether-blue" : "text-storm-cloud"}`}
          >
            {autoRefresh ? "toggle_on" : "toggle_off"}
          </span>
          <span className="hidden text-storm-cloud sm:inline">Auto-refresh</span>
          {autoRefresh && <span className="text-[10px] text-storm-cloud tabular-nums">({countdown}s)</span>}
        </button>

        {/* Refresh all button */}
        <button
          type="button"
          onClick={refreshAll}
          disabled={refreshingAll}
          className="h-7 px-2.5 rounded-[4px] border border-charcoal-grey text-[11px] text-storm-cloud hover:text-porcelain hover:bg-deep-slate transition-colors disabled:opacity-50 flex items-center gap-1"
          title="Refresh all"
        >
          <span className={`material-symbols-outlined text-[13px] ${refreshingAll ? "animate-spin" : ""}`}>
            refresh
          </span>
        </button>
      </div>

      {/* Grouped table */}
      <div className="rounded-[6px] border border-charcoal-grey overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_200px_64px_120px] bg-pitch-black/40 border-b border-charcoal-grey px-3 py-2">
          <div className="text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey">Provider</div>
          <div className="text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey">Progress</div>
          <div className="text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey text-right">%</div>
          <div className="text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey text-right">Actions</div>
        </div>

        {connectionsLoading ? (
          <div className="flex items-center justify-center py-10">
            <span className="material-symbols-outlined text-[28px] text-storm-cloud animate-spin">
              progress_activity
            </span>
          </div>
        ) : (
          sortedConnections.map((conn) => {
            const quota = quotaData[conn.id];
            const isLoading = loading[conn.id];
            const error = errors[conn.id];
            const isInactive = conn.isActive === false;
            const rowBusy = deletingId === conn.id || togglingId === conn.id;
            const expanded = expandedRows[conn.id] ?? true;
            const { totalUsed, totalLimit, pct } = getAccumulatedProgress(conn);
            const color = getStatusColor(pct);
            const cc = colorClasses(color);
            const isEmail = (v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            const accountLabel = isEmail(conn.email) ? conn.email : conn.name || null;

            return (
              <div
                key={conn.id}
                className={`border-b border-charcoal-grey/60 last:border-0 ${isInactive ? "opacity-60" : ""}`}
              >
                {/* Provider header row */}
                <div
                  className="grid grid-cols-[1fr_200px_64px_120px] items-center px-3 py-2.5 bg-graphite hover:bg-deep-slate cursor-pointer transition-colors duration-100"
                  onClick={() => setExpandedRows((prev) => ({ ...prev, [conn.id]: !(prev[conn.id] ?? true) }))}
                >
                  {/* Provider identity */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[13px] text-fog-grey shrink-0">
                      {expanded ? "expand_more" : "chevron_right"}
                    </span>
                    <div className="w-5 h-5 shrink-0 rounded-[4px] bg-white flex items-center justify-center overflow-hidden">
                      <ProviderIcon
                        src={`/providers/${conn.provider}.png`}
                        alt={conn.provider}
                        size={20}
                        className="object-contain"
                        fallbackText={conn.provider?.slice(0, 2).toUpperCase() || "PR"}
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[13px] font-[510] text-porcelain capitalize tracking-[-0.12px]">
                        {conn.provider}
                      </span>
                      {accountLabel && (
                        <span className="ml-2 text-[11px] text-storm-cloud truncate">{accountLabel}</span>
                      )}
                    </div>
                  </div>

                  {/* Accumulated progress bar */}
                  <div className="pr-3" onClick={(e) => e.stopPropagation()}>
                    {totalLimit > 0 ? (
                      <div className={`h-1.5 rounded-full overflow-hidden ${cc.track}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${cc.bar}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    ) : (
                      <div className="h-1.5 rounded-full bg-charcoal-grey/40" />
                    )}
                  </div>

                  {/* Percentage badge */}
                  <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    {totalLimit > 0 ? (
                      <span className={`text-[11px] font-[510] tabular-nums ${cc.text}`}>{pct}%</span>
                    ) : (
                      <span className="text-[11px] text-storm-cloud">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => refreshProvider(conn.id, conn.provider)}
                      disabled={isLoading || rowBusy}
                      className="flex items-center justify-center size-6 rounded-[4px] text-fog-grey hover:bg-charcoal-grey hover:text-porcelain transition-colors duration-100 disabled:opacity-40"
                      title="Refresh quota"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isLoading ? "animate-spin" : ""}`}>
                        refresh
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedConnection(conn);
                        setShowEditModal(true);
                      }}
                      disabled={rowBusy}
                      className="flex items-center justify-center size-6 rounded-[4px] text-fog-grey hover:bg-charcoal-grey hover:text-porcelain transition-colors duration-100 disabled:opacity-40"
                      title="Edit connection"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openConfirm(
                          "Delete Connection",
                          "Are you sure you want to delete this connection?",
                          () => handleDeleteConnection(conn.id),
                          "danger",
                        )
                      }
                      disabled={rowBusy}
                      className="flex items-center justify-center size-6 rounded-[4px] text-fog-grey hover:bg-warning-red/10 hover:text-warning-red transition-colors duration-100 disabled:opacity-40"
                      title="Delete connection"
                    >
                      <span
                        className={`material-symbols-outlined text-[14px] ${deletingId === conn.id ? "animate-pulse" : ""}`}
                      >
                        delete
                      </span>
                    </button>
                    <div className="pl-0.5">
                      <Toggle
                        size="sm"
                        checked={conn.isActive ?? true}
                        disabled={rowBusy}
                        onChange={(nextActive) => handleToggleConnectionActive(conn.id, nextActive)}
                      />
                    </div>
                  </div>
                </div>

                {/* Model sub-rows */}
                {expanded && (
                  <div className="border-t border-charcoal-grey/40">
                    {isLoading ? (
                      <div className="flex items-center gap-2 px-10 py-3">
                        <span className="material-symbols-outlined text-[16px] text-storm-cloud animate-spin">
                          progress_activity
                        </span>
                        <span className="text-[11px] text-storm-cloud">Loading quota…</span>
                      </div>
                    ) : error ? (
                      <div className="flex items-center gap-2 px-10 py-3">
                        <span className="material-symbols-outlined text-[16px] text-red-400">error</span>
                        <span className="text-[11px] text-storm-cloud">{error}</span>
                      </div>
                    ) : quota?.message ? (
                      <div className="px-10 py-3">
                        <span className="text-[11px] text-storm-cloud">{quota.message}</span>
                      </div>
                    ) : !quota?.quotas?.length ? (
                      <div className="px-10 py-3">
                        <span className="text-[11px] text-storm-cloud">No quota data</span>
                      </div>
                    ) : (
                      quota.quotas.map((q, idx) => {
                        const remaining =
                          q.remainingPercentage !== undefined
                            ? Math.round(q.remainingPercentage)
                            : calculatePercentage(q.used, q.total);
                        const qColor = getStatusColor(remaining);
                        const qcc = colorClasses(qColor);
                        const countdown = formatResetTime(q.resetAt);

                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-[1fr_200px_64px_120px] items-center px-3 py-2 bg-pitch-black/20 hover:bg-deep-slate/50 border-b border-charcoal-grey/30 last:border-0 transition-colors duration-100"
                          >
                            {/* Model name — indented */}
                            <div className="flex items-center gap-2 pl-8 min-w-0">
                              <span className={`text-[9px] shrink-0 ${qcc.text}`}>●</span>
                              <span className="text-[12px] text-storm-cloud truncate">{q.name}</span>
                            </div>

                            {/* Progress bar */}
                            <div className="pr-3">
                              <div className={`h-1 rounded-full overflow-hidden ${qcc.track}`}>
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${qcc.bar}`}
                                  style={{ width: `${Math.min(remaining, 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[10px] text-storm-cloud tabular-nums">
                                  {q.used.toLocaleString()} / {q.total > 0 ? q.total.toLocaleString() : "∞"}
                                </span>
                              </div>
                            </div>

                            {/* Remaining % */}
                            <div className="text-right">
                              <span className={`text-[11px] font-[510] tabular-nums ${qcc.text}`}>{remaining}%</span>
                            </div>

                            {/* Resets in */}
                            <div className="text-right pr-1">
                              {countdown !== "-" ? (
                                <span className="text-[11px] text-storm-cloud tabular-nums">in {countdown}</span>
                              ) : (
                                <span className="text-[11px] text-storm-cloud/40">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <EditConnectionModal
        isOpen={showEditModal}
        connection={selectedConnection}
        proxyPools={proxyPools}
        onSave={handleUpdateConnection}
        onClose={() => {
          setShowEditModal(false);
          setSelectedConnection(null);
        }}
      />

      <ConfirmModal
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          closeConfirm();
        }}
        onClose={closeConfirm}
        confirmText="Confirm"
        cancelText="Cancel"
        variant={confirmDialog.variant}
      />
    </div>
  );
}
