import crypto from "crypto";
import open from "open";
import { ANTIGRAVITY_CONFIG } from "../constants/oauth.js";
import { getServerCredentials } from "../config/index.js";
import { startLocalServer } from "../utils/server.js";
import { spinner as createSpinner } from "../utils/ui.js";

/**
 * Antigravity OAuth Service
 * Uses standard OAuth2 Authorization Code flow (similar to Gemini)
 */
export class AntigravityService {
  constructor() {
    this.config = ANTIGRAVITY_CONFIG;
  }

  /**
   * Build Antigravity authorization URL
   */
  buildAuthUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: this.config.scopes.join(" "),
      state: state,
      access_type: "offline",
      prompt: "consent",
    });

    return `${this.config.authorizeUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code, redirectUri) {
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken) {
    const response = await fetch(`${this.config.userInfoUrl}?alt=json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user info: ${error}`);
    }

    return await response.json();
  }

  /**
   * Fetch Project ID from loadCodeAssist API
   */
  async fetchProjectId(accessToken) {
    const loadReqBody = {
      metadata: {
        ideType: "IDE_UNSPECIFIED",
        platform: "PLATFORM_UNSPECIFIED",
        pluginType: "GEMINI",
      },
    };

    const response = await fetch(this.config.loadCodeAssistEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": this.config.loadCodeAssistUserAgent,
        "X-Goog-Api-Client": this.config.loadCodeAssistApiClient,
        "Client-Metadata": this.config.loadCodeAssistClientMetadata,
      },
      body: JSON.stringify(loadReqBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch project ID: ${errorText}`);
    }

    const loadResp = await response.json();
    let projectId = loadResp.cloudaicompanionProject;

    if (typeof projectId === 'object' && projectId !== null && projectId.id) {
      projectId = projectId.id;
    }

    if (!projectId) {
      throw new Error("No cloudaicompanionProject found in response");
    }

    return projectId;
  }

  /**
   * Save Antigravity tokens to server
   */
  async saveTokens(tokens, userInfo, projectId) {
    const { server, token, userId } = getServerCredentials();

    const response = await fetch(`${server}/api/cli/providers/antigravity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-User-Id": userId,
      },
      body: JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
        email: userInfo.email,
        projectId: projectId, // Send projectId to server
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save tokens");
    }

    return await response.json();
  }

  /**
   * Complete Antigravity OAuth flow
   */
  async connect() {
    const spinner = createSpinner("Starting Antigravity OAuth...").start();

    try {
      spinner.text = "Starting local server...";

      // Start local server for callback
      let callbackParams = null;
      const { port, close } = await startLocalServer((params) => {
        callbackParams = params;
      });

      const redirectUri = `http://localhost:${port}/callback`;
      spinner.succeed(`Local server started on port ${port}`);

      // Generate state
      const state = crypto.randomBytes(32).toString("base64url");

      // Build authorization URL
      const authUrl = this.buildAuthUrl(redirectUri, state);

      console.log("\nOpening browser for Antigravity authentication...");
      console.log(`If browser doesn't open, visit:\n${authUrl}\n`);

      // Open browser
      await open(authUrl);

      // Wait for callback
      spinner.start("Waiting for Antigravity authorization...");

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Authentication timeout (5 minutes)"));
        }, 300000);

        const checkInterval = setInterval(() => {
          if (callbackParams) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

      close();

      if (callbackParams.error) {
        throw new Error(callbackParams.error_description || callbackParams.error);
      }

      if (!callbackParams.code) {
        throw new Error("No authorization code received");
      }

      spinner.start("Exchanging code for tokens...");

      // Exchange code for tokens
      const tokens = await this.exchangeCode(callbackParams.code, redirectUri);

      spinner.text = "Fetching user info...";

      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token);

      spinner.text = "Fetching Google Cloud Project ID...";

      // Fetch Project ID
      const projectId = await this.fetchProjectId(tokens.access_token);

      spinner.text = "Saving tokens to server...";

      // Save tokens to server
      await this.saveTokens(tokens, userInfo, projectId);

      spinner.succeed(`Antigravity connected successfully! (${userInfo.email}, Project: ${projectId})`);
      return true;
    } catch (error) {
      spinner.fail(`Failed: ${error.message}`);
      throw error;
    }
  }
}

