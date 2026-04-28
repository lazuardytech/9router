"use client";

import Card from "./Card";

// Field schema — config-driven, used for both searchConfig and fetchConfig
const FIELD_SCHEMA = {
  baseUrl:          { label: "Endpoint",   format: (v) => v, isLink: true, mono: true },
  method:           { label: "Method",     format: (v) => v },
  authType:         { label: "Auth",       format: (v) => v },
  authHeader:       { label: "Auth Header", format: (v) => v, mono: true },
  costPerQuery:     { label: "Cost / call", format: (v) => v === 0 ? "Free" : `$${v.toFixed(4)}` },
  freeMonthlyQuota: { label: "Free quota",  format: (v) => v === 0 ? "—" : v >= 999999 ? "Unlimited" : `${v.toLocaleString()} / mo` },
  searchTypes:      { label: "Types",      format: (v) => v.join(", ") },
  formats:          { label: "Formats",    format: (v) => v.join(", ") },
  defaultMaxResults: { label: "Default results", format: (v) => v },
  maxMaxResults:    { label: "Max results", format: (v) => v },
  maxCharacters:    { label: "Max chars",  format: (v) => v.toLocaleString() },
  timeoutMs:        { label: "Timeout",    format: (v) => `${v / 1000}s` },
  cacheTTLMs:       { label: "Cache TTL",  format: (v) => `${v / 60000}m` },
};

export default function ProviderInfoCard({ config, title = "Provider Info" }) {
  if (!config) return null;

  const rows = Object.entries(FIELD_SCHEMA)
    .filter(([key]) => config[key] !== undefined && config[key] !== null && config[key] !== "")
    .map(([key, schema]) => ({
      key,
      label: schema.label,
      value: schema.format(config[key]),
      isLink: schema.isLink,
      mono: schema.mono,
      raw: config[key],
    }));

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-text-muted w-28 shrink-0">{r.label}</span>
            {r.isLink ? (
              <a
                href={r.raw}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm text-primary hover:underline truncate ${r.mono ? "font-mono" : ""}`}
              >
                {r.value}
              </a>
            ) : (
              <span className={`text-sm text-text-main truncate ${r.mono ? "font-mono" : ""}`}>
                {r.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
