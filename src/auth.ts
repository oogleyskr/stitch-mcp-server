/**
 * Authentication module for the Stitch MCP Server.
 *
 * Supports three methods (checked in priority order):
 *   1. STITCH_API_KEY environment variable
 *   2. STITCH_ACCESS_TOKEN environment variable
 *   3. gcloud CLI fallback (runs `gcloud auth print-access-token`)
 */

import { execSync } from "child_process";
import type { AuthCredentials } from "./types";

/** Stderr logger — MCP servers must not write to stdout. */
const log = (msg: string): void => {
  console.error(`[stitch-mcp] ${msg}`);
};

/**
 * Attempts to retrieve a token via the gcloud CLI.
 * Returns null when gcloud is unavailable or the command fails.
 */
function getGcloudToken(): string | null {
  try {
    const token = execSync("gcloud auth print-access-token 2>/dev/null", {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 10_000,
    }).trim();

    if (token && token.startsWith("ya29.")) {
      return token;
    }
  } catch {
    // gcloud not installed or not authenticated — fall through
  }
  return null;
}

/**
 * Resolves authentication credentials using the three-method priority chain.
 *
 * @throws {Error} When no authentication method succeeds.
 */
export function resolveAuth(): AuthCredentials {
  // 1. API key (highest priority)
  const apiKey = process.env.STITCH_API_KEY;
  if (apiKey) {
    log("Authenticated via STITCH_API_KEY");
    return { token: apiKey, method: "api_key" };
  }

  // 2. Explicit access token
  const accessToken = process.env.STITCH_ACCESS_TOKEN;
  if (accessToken) {
    log("Authenticated via STITCH_ACCESS_TOKEN");
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      undefined;
    return { token: accessToken, method: "access_token", projectId };
  }

  // 3. gcloud CLI fallback
  const gcloudToken = getGcloudToken();
  if (gcloudToken) {
    log("Authenticated via gcloud CLI");
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      undefined;
    return { token: gcloudToken, method: "gcloud", projectId };
  }

  throw new Error(
    "No authentication method available. Set STITCH_API_KEY, STITCH_ACCESS_TOKEN, or configure gcloud CLI."
  );
}

/**
 * Builds the HTTP headers required for a Stitch API request.
 *
 * @param creds - Resolved authentication credentials.
 * @param projectId - Optional per-request project override.
 */
export function buildHeaders(
  creds: AuthCredentials,
  projectId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (creds.method === "api_key") {
    headers["X-Goog-Api-Key"] = creds.token;
  } else {
    headers["Authorization"] = `Bearer ${creds.token}`;
  }

  const pid = projectId ?? creds.projectId;
  if (pid) {
    headers["X-Goog-User-Project"] = pid;
  }

  return headers;
}
