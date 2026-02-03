import { translateResponse, initState } from "../translator/index.js";
import { FORMATS } from "../translator/formats.js";
import { trackPendingRequest, appendRequestLog } from "@/lib/usageDb.js";
import { extractUsage, hasValidUsage, estimateUsage, logUsage, COLORS } from "./usageTracking.js";

// Re-export COLORS for backward compatibility
export { COLORS };

// Singleton TextEncoder/Decoder for performance (reuse across all streams)
const sharedDecoder = new TextDecoder();
const sharedEncoder = new TextEncoder();

// Parse SSE data line (optimized - reduce string operations)
function parseSSELine(line) {
  if (!line || line.charCodeAt(0) !== 100) return null; // 'd' = 100

  const data = line.slice(5).trim();
  if (data === "[DONE]") return { done: true };

  try {
    return JSON.parse(data);
  } catch (error) {
    // Log parse errors for debugging incomplete chunks
    if (data.length > 0 && data.length < 1000) {
      console.log(`[WARN] Failed to parse SSE line (${data.length} chars): ${data.substring(0, 100)}...`);
    }
    return null;
  }
}

/**
 * Format output as SSE
 * @param {object} data - Data to format
 * @param {string} sourceFormat - Target format for client
 * @returns {string} SSE formatted string
 */
export function formatSSE(data, sourceFormat) {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return "data: null\n\n";
  }

  if (data && data.done) return "data: [DONE]\n\n";

  // OpenAI Responses API format: has event field
  if (data && data.event && data.data) {
    return `event: ${data.event}\ndata: ${JSON.stringify(data.data)}\n\n`;
  }

  // Claude format: include event prefix
  if (sourceFormat === FORMATS.CLAUDE && data && data.type) {
    // If perf_metrics is null, remove it to avoid serialization issues
    if (data.usage && typeof data.usage === 'object' && data.usage.perf_metrics === null) {
      const { perf_metrics, ...usageWithoutPerf } = data.usage;
      data = { ...data, usage: usageWithoutPerf };
    }
    return `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  // If perf_metrics is null, remove it to avoid serialization issues
  if (data?.usage && typeof data.usage === 'object' && data.usage.perf_metrics === null) {
    const { perf_metrics, ...usageWithoutPerf } = data.usage;
    data = { ...data, usage: usageWithoutPerf };
  }

  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Stream modes
 */
const STREAM_MODE = {
  TRANSLATE: "translate",    // Full translation between formats
  PASSTHROUGH: "passthrough" // No translation, normalize output, extract usage
};

/**
 * Create unified SSE transform stream
 * @param {object} options
 * @param {string} options.mode - Stream mode: translate, passthrough
 * @param {string} options.targetFormat - Provider format (for translate mode)
 * @param {string} options.sourceFormat - Client format (for translate mode)
 * @param {string} options.provider - Provider name
 * @param {object} options.reqLogger - Request logger instance
 * @param {string} options.model - Model name
 * @param {string} options.connectionId - Connection ID for usage tracking
 * @param {object} options.body - Request body (for input token estimation)
 */
export function createSSEStream(options = {}) {
  const {
    mode = STREAM_MODE.TRANSLATE,
    targetFormat,
    sourceFormat,
    provider = null,
    reqLogger = null,
    toolNameMap = null,
    model = null,
    connectionId = null,
    body = null
  } = options;

  let buffer = "";
  let usage = null;

  // State for translate mode
  const state = mode === STREAM_MODE.TRANSLATE ? { ...initState(sourceFormat), provider, toolNameMap } : null;

  // Track content length for usage estimation (both modes)
  let totalContentLength = 0;

  return new TransformStream({
    transform(chunk, controller) {
      const text = sharedDecoder.decode(chunk, { stream: true });
      buffer += text;
      reqLogger?.appendProviderChunk?.(text);

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();

        // Passthrough mode: normalize and forward
        if (mode === STREAM_MODE.PASSTHROUGH) {
          let output;
          let injectedUsage = false;

          if (trimmed.startsWith("data:") && trimmed.slice(5).trim() !== "[DONE]") {
            try {
              const parsed = JSON.parse(trimmed.slice(5).trim());

              // Track content length for estimation
              const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.delta?.reasoning_content;
              if (content && typeof content === "string") {
                totalContentLength += content.length;
              }

              // Extract usage from chunk
              const extracted = extractUsage(parsed);
              if (extracted) {
                usage = extracted;
              }

              // Inject estimated usage into final chunk (has finish_reason but no valid usage)
              const isFinishChunk = parsed.choices?.[0]?.finish_reason;
              if (isFinishChunk && !hasValidUsage(parsed.usage)) {
                const estimated = estimateUsage(body, totalContentLength, FORMATS.OPENAI);
                parsed.usage = estimated;
                output = `data: ${JSON.stringify(parsed)}\n`;
                usage = estimated;
                injectedUsage = true;
              }
            } catch { }
          }

          // Normalize if not already injected
          if (!injectedUsage) {
            if (line.startsWith("data:") && !line.startsWith("data: ")) {
              output = "data: " + line.slice(5) + "\n";
            } else {
              output = line + "\n";
            }
          }

          reqLogger?.appendConvertedChunk?.(output);
          controller.enqueue(sharedEncoder.encode(output));
          continue;
        }

        // Translate mode
        if (!trimmed) continue;

        const parsed = parseSSELine(trimmed);
        if (!parsed) continue;

        if (parsed && parsed.done) {
          const output = "data: [DONE]\n\n";
          reqLogger?.appendConvertedChunk?.(output);
          controller.enqueue(sharedEncoder.encode(output));
          continue;
        }

        // Track content length for estimation (from various formats)
        const content = parsed.delta?.text || // Claude
          parsed.choices?.[0]?.delta?.content || // OpenAI
          parsed.candidates?.[0]?.content?.parts?.[0]?.text; // Gemini
        if (content && typeof content === "string") {
          totalContentLength += content.length;
        }

        // Extract usage
        const extracted = extractUsage(parsed);
        if (extracted) state.usage = extracted;

        // Translate: targetFormat -> openai -> sourceFormat
        const translated = translateResponse(targetFormat, sourceFormat, parsed, state);

        // Log OpenAI intermediate chunks (if available)
        if (translated?._openaiIntermediate) {
          for (const item of translated._openaiIntermediate) {
            const openaiOutput = formatSSE(item, FORMATS.OPENAI);
            reqLogger?.appendOpenAIChunk?.(openaiOutput);
          }
        }

        if (translated?.length > 0) {
          for (const item of translated) {
            // Inject estimated usage if finish chunk has no valid usage
            const isFinishChunk = item.type === "message_delta" || item.choices?.[0]?.finish_reason;
            if (state.finishReason && isFinishChunk && !hasValidUsage(item.usage) && totalContentLength > 0) {
              const estimated = estimateUsage(body, totalContentLength, sourceFormat);
              item.usage = estimated;
              state.usage = estimated;
            }

            const output = formatSSE(item, sourceFormat);
            reqLogger?.appendConvertedChunk?.(output);
            controller.enqueue(sharedEncoder.encode(output));
          }
        }
      }
    },

    flush(controller) {
      trackPendingRequest(model, provider, connectionId, false);
      try {
        const remaining = sharedDecoder.decode();
        if (remaining) buffer += remaining;

        if (mode === STREAM_MODE.PASSTHROUGH) {
          if (buffer) {
            let output = buffer;
            if (buffer.startsWith("data:") && !buffer.startsWith("data: ")) {
              output = "data: " + buffer.slice(5);
            }
            reqLogger?.appendConvertedChunk?.(output);
            controller.enqueue(sharedEncoder.encode(output));
          }

          // Estimate usage if provider didn't return valid usage (PASSTHROUGH is always OpenAI format)
          if (!hasValidUsage(usage) && totalContentLength > 0) {
            usage = estimateUsage(body, totalContentLength, FORMATS.OPENAI);
          }

          if (hasValidUsage(usage)) {
            logUsage(provider, usage, model, connectionId);
          } else {
            appendRequestLog({ model, provider, connectionId, tokens: null, status: "200 OK" }).catch(() => { });
          }
          return;
        }

        // Translate mode: process remaining buffer
        if (buffer.trim()) {
          const parsed = parseSSELine(buffer.trim());
          if (parsed && !parsed.done) {
            const translated = translateResponse(targetFormat, sourceFormat, parsed, state);

            // Log OpenAI intermediate chunks
            if (translated?._openaiIntermediate) {
              for (const item of translated._openaiIntermediate) {
                const openaiOutput = formatSSE(item, FORMATS.OPENAI);
                reqLogger?.appendOpenAIChunk?.(openaiOutput);
              }
            }

            if (translated?.length > 0) {
              for (const item of translated) {
                const output = formatSSE(item, sourceFormat);
                reqLogger?.appendConvertedChunk?.(output);
                controller.enqueue(sharedEncoder.encode(output));
              }
            }
          }
        }

        // Flush remaining events (only once at stream end)
        const flushed = translateResponse(targetFormat, sourceFormat, null, state);

        // Log OpenAI intermediate chunks for flushed events
        if (flushed?._openaiIntermediate) {
          for (const item of flushed._openaiIntermediate) {
            const openaiOutput = formatSSE(item, FORMATS.OPENAI);
            reqLogger?.appendOpenAIChunk?.(openaiOutput);
          }
        }

        if (flushed?.length > 0) {
          for (const item of flushed) {
            const output = formatSSE(item, sourceFormat);
            reqLogger?.appendConvertedChunk?.(output);
            controller.enqueue(sharedEncoder.encode(output));
          }
        }

        // Send [DONE] and log usage
        const doneOutput = "data: [DONE]\n\n";
        reqLogger?.appendConvertedChunk?.(doneOutput);
        controller.enqueue(sharedEncoder.encode(doneOutput));

        // Estimate usage if provider didn't return valid usage (for translate mode)
        if (!hasValidUsage(state?.usage) && totalContentLength > 0) {
          state.usage = estimateUsage(body, totalContentLength, sourceFormat);
        }

        if (hasValidUsage(state?.usage)) {
          logUsage(state.provider || targetFormat, state.usage, model, connectionId);
        } else {
          appendRequestLog({ model, provider, connectionId, tokens: null, status: "200 OK" }).catch(() => { });
        }
      } catch (error) {
        console.log("Error in flush:", error);
      }
    }
  });
}

// Convenience functions for backward compatibility
export function createSSETransformStreamWithLogger(targetFormat, sourceFormat, provider = null, reqLogger = null, toolNameMap = null, model = null, connectionId = null, body = null) {
  return createSSEStream({
    mode: STREAM_MODE.TRANSLATE,
    targetFormat,
    sourceFormat,
    provider,
    reqLogger,
    toolNameMap,
    model,
    connectionId,
    body
  });
}

export function createPassthroughStreamWithLogger(provider = null, reqLogger = null, model = null, connectionId = null, body = null) {
  return createSSEStream({
    mode: STREAM_MODE.PASSTHROUGH,
    provider,
    reqLogger,
    model,
    connectionId,
    body
  });
}
