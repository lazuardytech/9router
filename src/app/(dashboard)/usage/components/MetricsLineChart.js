"use client";

import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

const fmtNum = (n) => {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat().format(Math.round(n));
};

const fmtCost = (n) => `$${(n || 0).toFixed(4)}`;

function Sparkline({ data, field, color, fmt }) {
  const values = data.map((d) => d[field] ?? 0);
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

  const [hovered, setHovered] = useState(null);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" aria-hidden="true" onMouseLeave={() => setHovered(null)}>
        {/* Area fill */}
        <polygon points={areaPoints} fill={color} fillOpacity="0.08" />
        {/* Line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {/* Hover dots */}
        {values.map((v, i) => {
          const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
          const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2"
              fill={color}
              fillOpacity={hovered === i ? 1 : 0}
              stroke="none"
              className="cursor-crosshair"
              onMouseEnter={() => setHovered(i)}
            />
          );
        })}
        {/* Invisible hover targets */}
        {values.map((v, i) => {
          const x = PAD + (i / Math.max(1, values.length - 1)) * (W - PAD * 2);
          return (
            <rect
              key={`hit-${i}`}
              x={x - 4}
              y={0}
              width={8}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
            />
          );
        })}
      </svg>
      {/* Tooltip */}
      {hovered !== null && data[hovered] && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-deep-slate border border-charcoal-grey rounded-[4px] px-2 py-0.5 text-[10px] text-porcelain whitespace-nowrap pointer-events-none z-10">
          {data[hovered].label}: {fmt(data[hovered][field] ?? 0)}
        </div>
      )}
    </div>
  );
}

const METRICS = [
  {
    key: "requests",
    label: "Total Requests",
    icon: "receipt_long",
    color: "#d0d6e0",
    fmt: fmtNum,
  },
  {
    key: "promptTokens",
    label: "Input Tokens",
    icon: "input",
    color: "#5e6ad2",
    fmt: fmtNum,
  },
  {
    key: "completionTokens",
    label: "Output Tokens",
    icon: "output",
    color: "#27a644",
    fmt: fmtNum,
  },
  {
    key: "cost",
    label: "Est. Cost",
    icon: "payments",
    color: "#f59e0b",
    fmt: fmtCost,
  },
];

export default function MetricsLineChart({ period = "7d" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage/chart?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = data.reduce(
    (acc, d) => ({
      requests: acc.requests + (d.requests ?? 0),
      promptTokens: acc.promptTokens + (d.promptTokens ?? 0),
      completionTokens: acc.completionTokens + (d.completionTokens ?? 0),
      cost: acc.cost + (d.cost ?? 0),
    }),
    { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 },
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {METRICS.map((m) => (
        <div
          key={m.key}
          className="rounded-[6px] border border-charcoal-grey bg-graphite overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
            <span className="material-symbols-outlined text-[14px]" style={{ color: m.color }}>
              {m.icon}
            </span>
            <span className="text-[10px] font-[590] uppercase tracking-[0.05em] text-fog-grey">{m.label}</span>
          </div>

          {/* Value */}
          <p className="text-lg font-mono font-[510] text-porcelain tracking-[-0.13px] px-3 pb-2">
            {loading ? "—" : m.fmt(totals[m.key])}
          </p>

          {/* Sparkline flush to bottom */}
          {loading ? (
            <div className="h-10 bg-deep-slate animate-pulse" />
          ) : data.length < 2 ? (
            <div className="h-10 flex items-center justify-center text-[10px] text-fog-grey">No data</div>
          ) : (
            <div className="mt-auto">
              <Sparkline data={data} field={m.key} color={m.color} fmt={m.fmt} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

MetricsLineChart.propTypes = {
  period: PropTypes.string,
};
