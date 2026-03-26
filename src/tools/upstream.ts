/**
 * Upstream Stitch tools — proxied directly through to Google's MCP endpoint.
 *
 * These seven tools map 1:1 to the tools available on the upstream
 * Stitch JSON-RPC endpoint. We define their schemas locally so they
 * appear in our MCP tool list even when the upstream is unreachable.
 */

import type { ToolDefinition, McpToolResult, AuthCredentials } from "../types";
import { callUpstreamTool } from "../stitch-client";

/** Tool definitions for the upstream Stitch tools. */
export const upstreamToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "list_projects",
    description: "Lists all Stitch projects accessible to the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_project",
    description: "Gets details of a specific Stitch project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_screens",
    description: "Lists all screens in a Stitch project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_screen",
    description: "Gets details of a specific screen including download URLs.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The screen ID." },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "generate_screen_from_text",
    description: "Generates a new screen from a text prompt describing the desired UI.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        prompt: { type: "string", description: "Text description of the screen to generate." },
        deviceType: {
          type: "string",
          enum: ["MOBILE", "DESKTOP", "TABLET"],
          description: "Target device type.",
          default: "MOBILE",
        },
      },
      required: ["projectId", "prompt"],
    },
  },
  {
    name: "edit_screens",
    description: "Edits one or more existing screens based on text instructions.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenIds: {
          type: "array",
          items: { type: "string" },
          description: "Screen IDs to edit.",
        },
        prompt: { type: "string", description: "Edit instructions." },
      },
      required: ["projectId", "screenIds", "prompt"],
    },
  },
  {
    name: "generate_variants",
    description: "Generates design variants of an existing screen.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The source screen ID." },
        count: { type: "number", description: "Number of variants to generate.", default: 3 },
      },
      required: ["projectId", "screenId"],
    },
  },
];

/** Names of upstream tools for quick lookup. */
export const UPSTREAM_TOOL_NAMES = new Set(
  upstreamToolDefinitions.map((t) => t.name)
);

/**
 * Handles an upstream tool call by proxying it to the Stitch MCP endpoint.
 *
 * @param name      - Tool name.
 * @param args      - Tool arguments.
 * @param creds     - Resolved auth credentials.
 * @param projectId - Optional project ID override.
 */
export async function handleUpstreamTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  try {
    const result = await callUpstreamTool(name, args, creds, projectId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}
