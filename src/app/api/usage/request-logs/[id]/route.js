import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/sqlite/connection";

/**
 * GET /api/usage/request-logs/[id]
 * Fetches the matching request_details row for a given request_log id.
 * Matches by finding the closest request_details row by timestamp + model.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDatabase();

    // Get the request_log row first
    const logRow = db.prepare("SELECT * FROM request_log WHERE id = ?").get(id);

    if (!logRow) {
      return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
    }

    // Try to find a matching request_details row.
    // Match by model within a ±30s window around the log timestamp, pick closest.
    // request_log timestamps are formatted as "DD-MM-YYYY HH:MM:SS" (local),
    // request_details timestamps are ISO strings — we do a broad range query
    // and pick the closest match by absolute time difference.
    let detail = null;

    try {
      // Parse the log timestamp "DD-MM-YYYY HH:MM:SS" → Date
      const parts = logRow.timestamp.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
      if (parts) {
        const [, dd, mm, yyyy, hh, min, ss] = parts;
        const logDate = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
        const windowMs = 30000; // ±30s
        const from = new Date(logDate.getTime() - windowMs).toISOString();
        const to = new Date(logDate.getTime() + windowMs).toISOString();

        const candidates = db
          .prepare(
            `SELECT * FROM request_details
             WHERE model = ? AND timestamp >= ? AND timestamp <= ?
             ORDER BY timestamp DESC
             LIMIT 10`,
          )
          .all(logRow.model, from, to);

        if (candidates.length > 0) {
          // Pick the one with the smallest time delta
          let best = candidates[0];
          let bestDelta = Math.abs(new Date(best.timestamp).getTime() - logDate.getTime());
          for (const c of candidates.slice(1)) {
            const delta = Math.abs(new Date(c.timestamp).getTime() - logDate.getTime());
            if (delta < bestDelta) {
              bestDelta = delta;
              best = c;
            }
          }
          detail = best;
        }
      }
    } catch {
      // detail stays null — not fatal
    }

    let payload = {};
    if (detail) {
      try {
        payload = JSON.parse(detail.data || "{}");
      } catch {}
    }

    return NextResponse.json({
      log: {
        id: logRow.id,
        timestamp: logRow.timestamp,
        model: logRow.model,
        provider: logRow.provider,
        account: logRow.account,
        promptTokens: logRow.prompt_tokens,
        completionTokens: logRow.completion_tokens,
        status: logRow.status,
        combo: logRow.combo,
      },
      detail: detail
        ? {
            id: detail.id,
            timestamp: detail.timestamp,
            provider: detail.provider,
            model: detail.model,
            status: detail.status,
            latency: payload.latency ?? (detail.latency_ms != null ? { total: detail.latency_ms } : {}),
            tokens: payload.tokens ?? {
              prompt_tokens: detail.prompt_tokens,
              completion_tokens: detail.completion_tokens,
            },
            request: payload.request ?? {},
            providerRequest: payload.providerRequest ?? {},
            providerResponse: payload.providerResponse ?? {},
            response: payload.response ?? {},
          }
        : null,
    });
  } catch (error) {
    console.error("[API ERROR] /api/usage/request-logs/[id] failed:", error);
    return NextResponse.json({ error: "Failed to fetch log detail" }, { status: 500 });
  }
}
