/**
 * Stitch API client — wraps JSON-RPC calls to the Google Stitch MCP endpoint
 * and provides helpers for REST-style operations (fetchImage, fetchHtml).
 */

import fetch from "node-fetch";
import type { AuthCredentials, StitchJsonRpcRequest, StitchJsonRpcResponse } from "./types";
import { buildHeaders } from "./auth";

/** Base URL for the Stitch MCP JSON-RPC endpoint. */
const STITCH_MCP_URL =
  process.env.STITCH_HOST || "https://stitch.googleapis.com/mcp";

/** Default request timeout in milliseconds. */
const TIMEOUT_MS = 180_000;

/** Monotonically increasing request ID for JSON-RPC. */
let requestIdCounter = 1;

/**
 * Sends a JSON-RPC 2.0 request to the Stitch MCP endpoint.
 *
 * @param method - JSON-RPC method name (e.g. "tools/call", "tools/list").
 * @param params - Parameters object for the RPC call.
 * @param creds  - Resolved authentication credentials.
 * @param projectId - Optional project ID override.
 * @returns The parsed JSON-RPC response.
 * @throws On HTTP errors, timeouts, or JSON-RPC error responses.
 */
export async function callStitchRpc(
  method: string,
  params: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<StitchJsonRpcResponse> {
  const body: StitchJsonRpcRequest = {
    jsonrpc: "2.0",
    method,
    params,
    id: requestIdCounter++,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(STITCH_MCP_URL, {
      method: "POST",
      headers: buildHeaders(creds, projectId),
      body: JSON.stringify(body),
      signal: controller.signal as any,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Stitch API HTTP ${response.status}: ${text}`);
    }

    return (await response.json()) as StitchJsonRpcResponse;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Stitch API request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calls a named upstream Stitch tool via JSON-RPC tools/call.
 *
 * @param toolName  - The upstream tool name (e.g. "list_projects").
 * @param args      - Arguments to pass to the tool.
 * @param creds     - Resolved authentication credentials.
 * @param projectId - Optional project ID override.
 */
export async function callUpstreamTool(
  toolName: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<unknown> {
  const response = await callStitchRpc(
    "tools/call",
    { name: toolName, arguments: args },
    creds,
    projectId
  );

  if (response.error) {
    throw new Error(
      `Stitch tool "${toolName}" error: ${response.error.message}`
    );
  }

  return response.result;
}

/**
 * Lists all tools available on the upstream Stitch MCP endpoint.
 *
 * @param creds     - Resolved authentication credentials.
 * @param projectId - Optional project ID override.
 */
export async function listUpstreamTools(
  creds: AuthCredentials,
  projectId?: string
): Promise<any[]> {
  const response = await callStitchRpc("tools/list", {}, creds, projectId);
  const result = response.result as any;
  return result?.tools ?? [];
}

/**
 * Downloads text content from a URL (used for fetching HTML from screen download URLs).
 *
 * @param url - The download URL.
 */
export async function downloadText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * Downloads binary content from a URL and returns it as a base64-encoded string.
 *
 * @param url - The download URL.
 */
export async function downloadBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

/**
 * Recursively searches an object tree for a property named `downloadUrl`.
 *
 * @param obj - The object to search.
 * @returns The first downloadUrl found, or null.
 */
export function findDownloadUrl(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  if (typeof record.downloadUrl === "string") return record.downloadUrl;
  for (const key of Object.keys(record)) {
    const found = findDownloadUrl(record[key]);
    if (found) return found;
  }
  return null;
}

/**
 * Recursively searches for a screenshot/image download URL in a screen result.
 *
 * @param obj - The screen result object.
 * @returns The first image URL found, or null.
 */
export function findImageUrl(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;

  // Check for screenshot.downloadUrl pattern
  const screenshot = record.screenshot as Record<string, unknown> | undefined;
  if (screenshot?.downloadUrl && typeof screenshot.downloadUrl === "string") {
    return screenshot.downloadUrl;
  }

  // Check for image-like downloadUrl
  if (typeof record.downloadUrl === "string") {
    const url = record.downloadUrl;
    const isImageUrl =
      url.includes(".png") ||
      url.includes(".jpg") ||
      (url.includes("googleusercontent.com") &&
        !url.includes("contribution.usercontent"));
    if (isImageUrl) return url;
  }

  for (const key of Object.keys(record)) {
    const found = findImageUrl(record[key]);
    if (found) return found;
  }
  return null;
}

/**
 * Fetches a screen's HTML content by calling get_screen upstream and downloading the code.
 *
 * @param projectId - The Stitch project ID.
 * @param screenId  - The screen ID.
 * @param creds     - Resolved authentication credentials.
 * @param pid       - Optional project ID override for the API call.
 */
export async function fetchScreenHtml(
  projectId: string,
  screenId: string,
  creds: AuthCredentials,
  pid?: string
): Promise<string> {
  const result = await callUpstreamTool(
    "get_screen",
    { projectId, screenId },
    creds,
    pid
  );

  const url = findDownloadUrl(result);
  if (!url) {
    throw new Error("No download URL found in screen data");
  }

  return downloadText(url);
}
