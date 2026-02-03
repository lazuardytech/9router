/**
 * Token Usage Tracking - Extract, normalize, estimate and log token usage
 */

import { saveRequestUsage, appendRequestLog } from "@/lib/usageDb.js";
import { FORMATS } from "../translator/formats.js";

// ANSI color codes
export const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

// Get HH:MM:SS timestamp
function getTimeString() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Normalize usage object - ensure all values are valid numbers
 */
export function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;

  const normalized = {};
  const assignNumber = (key, value) => {
    if (value === undefined || value === null) return;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) normalized[key] = numeric;
  };

  assignNumber("prompt_tokens", usage?.prompt_tokens);
  assignNumber("completion_tokens", usage?.completion_tokens);
  assignNumber("cache_read_input_tokens", usage?.cache_read_input_tokens);
  assignNumber("cache_creation_input_tokens", usage?.cache_creation_input_tokens);
  assignNumber("cached_tokens", usage?.cached_tokens);
  assignNumber("reasoning_tokens", usage?.reasoning_tokens);

  if (Object.keys(normalized).length === 0) return null;
  return normalized;
}

/**
 * Check if usage has valid token data
 * Valid = has at least one token field with value > 0
 * Invalid = empty object {}, null, undefined, no token fields, or all zeros
 */
export function hasValidUsage(usage) {
  if (!usage || typeof usage !== "object") return false;

  // Check for any known token field with value > 0
  const tokenFields = [
    "prompt_tokens", "completion_tokens", "total_tokens",  // OpenAI
    "input_tokens", "output_tokens",                        // Claude
    "promptTokenCount", "candidatesTokenCount"              // Gemini
  ];

  for (const field of tokenFields) {
    if (typeof usage[field] === "number" && usage[field] > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Extract usage from any format (Claude, OpenAI, Gemini, Responses API)
 */
export function extractUsage(chunk) {
  if (!chunk || typeof chunk !== "object") return null;

  // Claude format (message_delta event)
  if (chunk.type === "message_delta" && chunk.usage && typeof chunk.usage === "object") {
    return normalizeUsage({
      prompt_tokens: chunk.usage.input_tokens || 0,
      completion_tokens: chunk.usage.output_tokens || 0,
      cache_read_input_tokens: chunk.usage.cache_read_input_tokens,
      cache_creation_input_tokens: chunk.usage.cache_creation_input_tokens
    });
  }

  // OpenAI Responses API format (response.completed or response.done)
  if ((chunk.type === "response.completed" || chunk.type === "response.done") && chunk.response?.usage && typeof chunk.response.usage === "object") {
    const usage = chunk.response.usage;
    return normalizeUsage({
      prompt_tokens: usage.input_tokens || usage.prompt_tokens || 0,
      completion_tokens: usage.output_tokens || usage.completion_tokens || 0,
      cached_tokens: usage.input_tokens_details?.cached_tokens,
      reasoning_tokens: usage.output_tokens_details?.reasoning_tokens
    });
  }

  // OpenAI format
  if (chunk.usage && typeof chunk.usage === "object" && chunk.usage.prompt_tokens !== undefined) {
    return normalizeUsage({
      prompt_tokens: chunk.usage.prompt_tokens,
      completion_tokens: chunk.usage.completion_tokens || 0,
      cached_tokens: chunk.usage.prompt_tokens_details?.cached_tokens,
      reasoning_tokens: chunk.usage.completion_tokens_details?.reasoning_tokens
    });
  }

  // Gemini format (Antigravity)
  if (chunk.usageMetadata && typeof chunk.usageMetadata === "object") {
    return normalizeUsage({
      prompt_tokens: chunk.usageMetadata?.promptTokenCount || 0,
      completion_tokens: chunk.usageMetadata?.candidatesTokenCount || 0,
      cached_tokens: chunk.usageMetadata?.cachedContentTokenCount,
      reasoning_tokens: chunk.usageMetadata?.thoughtsTokenCount
    });
  }

  return null;
}

/**
 * Estimate input tokens from request body
 */
export function estimateInputTokens(body) {
  if (!body || typeof body !== "object") return 0;

  let totalChars = 0;

  // Count messages
  if (Array.isArray(body.messages)) {
    for (const msg of body.messages) {
      if (msg.content) {
        if (typeof msg.content === "string") {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.text) totalChars += part.text.length;
            if (part.type === "image_url") totalChars += 85; // Rough estimate for images
          }
        }
      }
      if (msg.role) totalChars += msg.role.length;
    }
  }

  // Count tools/functions
  if (Array.isArray(body.tools)) {
    totalChars += JSON.stringify(body.tools).length;
  } else if (Array.isArray(body.functions)) {
    totalChars += JSON.stringify(body.functions).length;
  }

  // Count system prompt
  if (body.system) {
    totalChars += typeof body.system === "string" ? body.system.length : JSON.stringify(body.system).length;
  }

  // Estimate: ~4 chars per token (rough average across all tokenizers)
  return Math.ceil(totalChars / 4);
}

/**
 * Estimate output tokens from content length
 */
export function estimateOutputTokens(contentLength) {
  if (!contentLength || contentLength <= 0) return 0;
  return Math.max(1, Math.floor(contentLength / 4));
}

/**
 * Format usage object based on target format
 * @param {number} inputTokens - Input/prompt tokens
 * @param {number} outputTokens - Output/completion tokens
 * @param {string} targetFormat - Target format from FORMATS
 */
export function formatUsage(inputTokens, outputTokens, targetFormat) {
  // Claude format uses input_tokens/output_tokens
  if (targetFormat === FORMATS.CLAUDE) {
    return { input_tokens: inputTokens, output_tokens: outputTokens, estimated: true };
  }

  // Default: OpenAI format (works for openai, gemini, responses, etc.)
  return {
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    estimated: true
  };
}

/**
 * Estimate full usage when provider doesn't return it
 * @param {object} body - Request body for input token estimation
 * @param {number} contentLength - Content length for output token estimation
 * @param {string} targetFormat - Target format from FORMATS constant
 */
export function estimateUsage(body, contentLength, targetFormat = FORMATS.OPENAI) {
  return formatUsage(
    estimateInputTokens(body),
    estimateOutputTokens(contentLength),
    targetFormat
  );
}

/**
 * Log usage with cache info (green color)
 */
export function logUsage(provider, usage, model = null, connectionId = null) {
  if (!usage || typeof usage !== "object") return;

  const p = provider?.toUpperCase() || "UNKNOWN";

  // Support both formats:
  // - OpenAI: prompt_tokens, completion_tokens
  // - Claude: input_tokens, output_tokens
  const inTokens = usage?.prompt_tokens || usage?.input_tokens || 0;
  const outTokens = usage?.completion_tokens || usage?.output_tokens || 0;
  const accountPrefix = connectionId ? connectionId.slice(0, 8) + "..." : "unknown";

  let msg = `[${getTimeString()}] 📊 ${COLORS.green}[USAGE] ${p} | in=${inTokens} | out=${outTokens} | account=${accountPrefix}${COLORS.reset}`;

  // Add estimated flag if present
  if (usage.estimated) {
    msg += ` ${COLORS.yellow}(estimated)${COLORS.reset}`;
  }

  // Add cache info if present (unified from different formats)
  const cacheRead = usage.cache_read_input_tokens || usage.cached_tokens;
  if (cacheRead) msg += ` | cache_read=${cacheRead}`;

  const cacheCreation = usage.cache_creation_input_tokens;
  if (cacheCreation) msg += ` | cache_create=${cacheCreation}`;

  const reasoning = usage.reasoning_tokens;
  if (reasoning) msg += ` | reasoning=${reasoning}`;

  console.log(msg);

  // Save to usage DB
  const tokens = {
    input: inTokens,
    output: outTokens,
    cacheRead: cacheRead || 0,
    cacheCreation: cacheCreation || 0,
    reasoning: reasoning || 0
  };
  saveRequestUsage({ model, provider, connectionId, tokens }).catch(() => { });
  appendRequestLog({ model, provider, connectionId, tokens, status: "200 OK" }).catch(() => { });
}
