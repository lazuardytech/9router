import { handleFetch } from "@/sse/handlers/fetch.js";
import { withApiKeyRateLimit } from "@/app/api/v1/_utils/apiKeyRateLimit.js";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * POST /v1/web/fetch - Web URL fetch/extract endpoint
 */
export async function POST(request) {
  return await withApiKeyRateLimit(request, () => handleFetch(request));
}
