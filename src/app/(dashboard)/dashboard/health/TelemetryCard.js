"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";

const REFRESH_MS = 30_000;
const MAX_SAMPLES = 24;

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(seconds = 0) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Sparkline({ samples, field, fmt }) {
  const [hovered, setHovered] = useState(null);
  const values = samples.map((s) => Number(s[field])).filter((v) => Number.isFinite(v));
  if (values.length < 2) return <div className="h-10 rounded-[4px] bg-deep-slate" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const W = 100;
  const H = 40;
  const PAD = 2;
  const points = values
    .map((v, i) => {
      const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPoints = `${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="h-10 w-full" onMouseLeave={() => setHovered(null)}>
        <polygon points={areaPoints} fill="currentColor" fillOpacity="0.06" className="text-porcelain" />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          points={points}
          className="text-porcelain/40"
        />
        {values.map((v, i) => {
          const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
          const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="2"
                fill="currentColor"
                fillOpacity={hovered === i ? 1 : 0}
                className="text-porcelain"
              />
              <rect x={x - 4} y={0} width={8} height={H} fill="transparent" onMouseEnter={() => setHovered(i)} />
            </g>
          );
        })}
      </svg>
      {hovered !== null && samples[hovered] && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-deep-slate border border-charcoal-grey rounded-[4px] px-2 py-1 text-[10px] text-porcelain whitespace-nowrap pointer-events-none z-10 shadow-[var(--shadow-xl)]">
          <div className="text-fog-grey">{new Date(samples[hovered].timestamp).toLocaleTimeString()}</div>
          <div className="font-[510]">{fmt ? fmt(samples[hovered][field]) : samples[hovered][field]}</div>
        </div>
      )}
    </div>
  );
}

const TelemetryCard = forwardRef(function TelemetryCard(_, ref) {
  const [health, setHealth] = useState(null);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/health");
      if (!res.ok) return;
      const json = await res.json();
      setHealth(json);
      setLastUpdated(new Date());
      const mem = json.system?.memoryUsage?.rss ?? 0;
      const heap = json.system?.memoryUsage?.heapUsed ?? 0;
      const newSample = { timestamp: Date.now(), memoryBytes: mem, heapUsed: heap };
      setSamples((prev) => {
        // Seed with 2 identical points on first load so sparkline renders immediately
        if (prev.length === 0) {
          return [{ ...newSample, timestamp: Date.now() - REFRESH_MS }, newSample];
        }
        return [...prev.slice(Math.max(0, prev.length - MAX_SAMPLES + 1)), newSample];
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  const sys = health?.system ?? {};

  const metrics = useMemo(
    () => [
      {
        label: "Uptime",
        value: formatDuration(sys.uptime ?? 0),
        icon: "timer",
        tone: "bg-aether-blue/10 text-aether-blue",
      },
      {
        label: "Memory RSS",
        value: formatBytes(sys.memoryUsage?.rss ?? 0),
        icon: "memory",
        tone: "bg-amethyst/10 text-amethyst",
      },
      {
        label: "Heap Used",
        value: formatBytes(sys.memoryUsage?.heapUsed ?? 0),
        icon: "storage",
        tone: "bg-cyan-spark/10 text-cyan-spark",
      },
      {
        label: "Free Memory",
        value: formatBytes(sys.freeMemory ?? 0),
        icon: "developer_board",
        tone: "bg-emerald/10 text-emerald",
      },
      {
        label: "CPUs",
        value: sys.cpus ?? "—",
        icon: "memory_alt",
        tone: "bg-storm-cloud/10 text-storm-cloud",
      },
      {
        label: "Platform",
        value: sys.platform ?? "—",
        icon: "computer",
        tone: "bg-fog-grey/10 text-fog-grey",
      },
    ],
    [sys],
  );

  return (
    <div className="rounded-[6px] border border-charcoal-grey bg-graphite p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-porcelain">monitoring</span>
          <h2 className="text-[14px] font-[510] text-porcelain tracking-[-0.13px]">System Telemetry</h2>
        </div>
        {lastUpdated && <span className="text-[11px] text-fog-grey">{lastUpdated.toLocaleTimeString()}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey">{m.label}</p>
              <span className={`material-symbols-outlined text-[14px] rounded-[4px] p-0.5 ${m.tone}`}>{m.icon}</span>
            </div>
            <p className="text-[15px] font-[510] text-porcelain tracking-[-0.13px]">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-3">
          <p className="text-[10px] text-fog-grey mb-2">Memory RSS trend</p>
          <Sparkline samples={samples} field="memoryBytes" fmt={formatBytes} />
        </div>
        <div className="rounded-[6px] border border-charcoal-grey bg-deep-slate p-3">
          <p className="text-[10px] text-fog-grey mb-2">Heap used trend</p>
          <Sparkline samples={samples} field="heapUsed" fmt={formatBytes} />
        </div>
      </div>
    </div>
  );
});

export default TelemetryCard;
