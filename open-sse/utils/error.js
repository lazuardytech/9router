// OpenAI-compatible error types mapping
const ERROR_TYPES = {
  400: { type: "invalid_request_error", code: "bad_request" },
  401: { type: "authentication_error", code: "invalid_api_key" },
  403: { type: "permission_error", code: "insufficient_quota" },
  404: { type: "invalid_request_error", code: "model_not_found" },
  429: { type: "rate_limit_error", code: "rate_limit_exceeded" },
  500: { type: "server_error", code: "internal_server_error" },
  502: { type: "server_error", code: "bad_gateway" },
  503: { type: "server_error", code: "service_unavailable" },
  504: { type: "server_error", code: "gateway_timeout" }
};

/**
 * Build OpenAI-compatible error response body
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {object} Error response object
 */
export function buildErrorBody(statusCode, message) {
  const errorInfo = ERROR_TYPES[statusCode] || 
    (statusCode >= 500 
      ? { type: "server_error", code: "internal_server_error" }
      : { type: "invalid_request_error", code: "" });

  return {
    error: {
      message: message || getDefaultMessage(statusCode),
      type: errorInfo.type,
      code: errorInfo.code
    }
  };
}

/**
 * Get default error message for status code
 */
function getDefaultMessage(statusCode) {
  const messages = {
    400: "Bad request",
    401: "Invalid API key provided",
    403: "You exceeded your current quota",
    404: "Model not found",
    429: "Rate limit exceeded",
    500: "Internal server error",
    502: "Bad gateway - upstream provider error",
    503: "Service temporarily unavailable",
    504: "Gateway timeout"
  };
  return messages[statusCode] || "An error occurred";
}

/**
 * Create error Response object (for non-streaming)
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {Response} HTTP Response object
 */
export function errorResponse(statusCode, message) {
  return new Response(JSON.stringify(buildErrorBody(statusCode, message)), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

/**
 * Write error to SSE stream (for streaming)
 * @param {WritableStreamDefaultWriter} writer - Stream writer
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 */
export async function writeStreamError(writer, statusCode, message) {
  const errorBody = buildErrorBody(statusCode, message);
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(`data: ${JSON.stringify(errorBody)}\n\n`));
}

/**
 * Parse upstream provider error response
 * @param {Response} response - Fetch response from provider
 * @returns {Promise<{statusCode: number, message: string}>}
 */
export async function parseUpstreamError(response) {
  let message = "";
  
  try {
    const text = await response.text();
    
    // Try parse as JSON
    try {
      const json = JSON.parse(text);
      message = json.error?.message || json.message || json.error || text;
    } catch {
      message = text;
    }
  } catch {
    message = `Upstream error: ${response.status}`;
  }

  return {
    statusCode: response.status,
    message: typeof message === "string" ? message : JSON.stringify(message)
  };
}

/**
 * Create error result for chatCore handler
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {{ success: false, status: number, error: string, response: Response }}
 */
export function createErrorResult(statusCode, message) {
  return {
    success: false,
    status: statusCode,
    error: message,
    response: errorResponse(statusCode, message)
  };
}

/**
 * Format provider error with context
 * @param {Error} error - Original error
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {number|string} statusCode - HTTP status code or error code
 * @returns {string} Formatted error message
 */
export function formatProviderError(error, provider, model, statusCode) {
  const code = statusCode || error.code || 'FETCH_FAILED';
  const message = error.message || "Unknown error";
  return `[${code}]: ${message}`;
}
