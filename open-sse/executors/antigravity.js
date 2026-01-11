import crypto from "crypto";
import { BaseExecutor } from "./base.js";
import { PROVIDERS, OAUTH_ENDPOINTS } from "../config/constants.js";

export class AntigravityExecutor extends BaseExecutor {
  constructor() {
    super("antigravity", PROVIDERS.antigravity);
  }

  buildUrl(model, stream, urlIndex = 0) {
    const baseUrls = this.getBaseUrls();
    const baseUrl = baseUrls[urlIndex] || baseUrls[0];
    const path = stream ? "/v1internal:streamGenerateContent?alt=sse" : "/v1internal:generateContent";
    return `${baseUrl}${path}`;
  }

  buildHeaders(credentials, stream = true) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${credentials.accessToken}`,
      "User-Agent": this.config.headers?.["User-Agent"] || "antigravity/1.104.0 darwin/arm64",
      ...(stream && { "Accept": "text/event-stream" })
    };
  }

  transformRequest(model, body, stream, credentials) {
    const projectId = credentials?.projectId || this.generateProjectId();
    
    return {
      ...body,
      project: projectId,
      model: model,
      userAgent: "antigravity",
      requestType: "agent",
      requestId: `agent-${crypto.randomUUID()}`,
      request: {
        ...body.request,
        sessionId: body.request?.sessionId || this.generateSessionId(),
        safetySettings: undefined,
        toolConfig: body.request?.tools?.length > 0 
          ? { functionCallingConfig: { mode: "VALIDATED" } }
          : body.request?.toolConfig
      }
    };
  }

  async refreshCredentials(credentials, log) {
    if (!credentials.refreshToken) return null;

    try {
      const response = await fetch(OAUTH_ENDPOINTS.google.token, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      });

      if (!response.ok) return null;

      const tokens = await response.json();
      log?.info?.("TOKEN", "Antigravity refreshed");

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || credentials.refreshToken,
        expiresIn: tokens.expires_in,
        projectId: credentials.projectId
      };
    } catch (error) {
      log?.error?.("TOKEN", `Antigravity refresh error: ${error.message}`);
      return null;
    }
  }

  generateProjectId() {
    const adj = ["useful", "bright", "swift", "calm", "bold"][Math.floor(Math.random() * 5)];
    const noun = ["fuze", "wave", "spark", "flow", "core"][Math.floor(Math.random() * 5)];
    return `${adj}-${noun}-${crypto.randomUUID().slice(0, 5)}`;
  }

  generateSessionId() {
    return `-${Math.floor(Math.random() * 9_000_000_000_000_000_000)}`;
  }
}

export default AntigravityExecutor;
