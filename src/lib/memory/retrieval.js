import { getDatabase } from "../sqlite/connection.js";

function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

function parseMetadata(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function rowToMemory(row) {
  const createdAt = row.created_at || new Date().toISOString();
  const updatedAt = row.updated_at || createdAt;
  return {
    id: String(row.id),
    apiKeyId: String(row.api_key_id || ""),
    sessionId: String(row.session_id || ""),
    type: String(row.type || ""),
    key: String(row.key || ""),
    content: String(row.content || ""),
    metadata: parseMetadata(row.metadata),
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)) : null,
  };
}

function keywordScore(memory, query) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) return 0;
  const haystacks = [
    String(memory.content || "").toLowerCase(),
    String(memory.key || "").toLowerCase(),
    JSON.stringify(memory.metadata || {}).toLowerCase(),
  ];
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const haystack of haystacks) {
    if (haystack.includes(normalizedQuery)) score += 20;
    for (const token of tokens) {
      if (!token) continue;
      if (haystack === String(memory.key || "").toLowerCase() && haystack.includes(token)) {
        score += 6;
        continue;
      }
      const matches = haystack.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
      score += (matches?.length || 0) * 3;
    }
  }
  return score;
}

function hasTable(tableName) {
  const db = getDatabase();
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return row?.name === tableName;
}

export async function retrieveMemories(apiKeyId, config = {}) {
  if (!apiKeyId) return [];
  const enabled = config.enabled !== false;
  if (!enabled) return [];

  const db = getDatabase();
  const maxTokens = Math.min(Math.max(Number(config.maxTokens || 2000), 1), 8000);
  const strategy = config.retrievalStrategy || "exact";
  const retentionDays = Number.isFinite(config.retentionDays) ? config.retentionDays : 30;
  const queryText = typeof config.query === "string" ? config.query.trim() : "";

  let baseQuery =
    "SELECT * FROM memories WHERE api_key_id = ? AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))";
  const baseParams = [apiKeyId];
  if (config.scope === "session" && config.sessionId) {
    baseQuery += " AND session_id = ?";
    baseParams.push(config.sessionId);
  }
  if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    baseQuery += " AND datetime(created_at) >= datetime(?)";
    baseParams.push(cutoff);
  }

  let rows = [];
  const ftsAvailable = hasTable("memory_fts");

  if ((strategy === "semantic" || strategy === "hybrid") && queryText && ftsAvailable) {
    try {
      rows = db
        .prepare(
          `SELECT m.* FROM memories m
           JOIN memory_fts f ON m.rowid = f.rowid
           WHERE f.memory_fts MATCH ?
             AND m.api_key_id = ?
             AND (m.expires_at IS NULL OR datetime(m.expires_at) > datetime('now'))
           ORDER BY m.created_at DESC
           LIMIT 100`,
        )
        .all(queryText, apiKeyId);
    } catch {
      rows = [];
    }
  }

  if (rows.length === 0 || strategy === "exact" || strategy === "hybrid") {
    const keywordRows = db.prepare(`${baseQuery} ORDER BY created_at DESC LIMIT 100`).all(...baseParams);
    if (strategy === "hybrid" && rows.length > 0) {
      const seen = new Set(rows.map((r) => String(r.id)));
      for (const row of keywordRows) {
        const id = String(row.id);
        if (seen.has(id)) continue;
        seen.add(id);
        rows.push(row);
      }
    } else if (rows.length === 0) {
      rows = keywordRows;
    }
  }

  const ranked = rows
    .map((row) => {
      const memory = rowToMemory(row);
      const score = queryText ? keywordScore(memory, queryText) : 0;
      return { memory, score };
    })
    .filter((entry) => !queryText || entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.memory.createdAt.getTime() - a.memory.createdAt.getTime();
    });

  const selected = [];
  let totalTokens = 0;
  for (const entry of ranked) {
    const tokens = estimateTokens(entry.memory.content);
    if (totalTokens + tokens > maxTokens) {
      if (selected.length === 0) {
        selected.push(entry.memory);
      }
      break;
    }
    selected.push(entry.memory);
    totalTokens += tokens;
  }
  return selected;
}
