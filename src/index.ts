#!/usr/bin/env node

/**
 * Stitch MCP Server — entry point.
 *
 * Combines the best of davideast/stitch-mcp and GreenSheep01201/stitch-mcp-auto
 * into a clean, modular TypeScript codebase with 25 tools across six categories:
 *
 *   - Upstream (7): Proxy through to Google's Stitch MCP endpoint
 *   - Code/Build (4): Screen code/image retrieval, site building, tool listing
 *   - Workspace (3): Local project association management
 *   - Design (5): Design context extraction, application, tokens, responsive, batch
 *   - Analysis (3): Accessibility, comparison, component extraction
 *   - Export (3): Style guides, design system export, trending design
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { resolveAuth } from "./auth";
import type { AuthCredentials, ToolDefinition, McpToolResult } from "./types";
import { listUpstreamTools } from "./stitch-client";

// Tool modules
import { upstreamToolDefinitions, UPSTREAM_TOOL_NAMES, handleUpstreamTool } from "./tools/upstream";
import { codeToolDefinitions, handleCodeTool } from "./tools/code";
import { workspaceToolDefinitions, handleWorkspaceTool, resolveProjectId } from "./tools/workspace";
import { designToolDefinitions, handleDesignTool } from "./tools/design";
import { analysisToolDefinitions, handleAnalysisTool } from "./tools/analysis";
import { exportToolDefinitions, handleExportTool } from "./tools/export";

// ─── Constants ───────────────────────────────────────────────────────────────

const SERVER_NAME = "stitch-mcp-server";
const SERVER_VERSION = "1.0.0";

/** Stderr logger — MCP servers must not write to stdout (reserved for JSON-RPC). */
const log = {
  info: (msg: string) => console.error(`[${SERVER_NAME}] ${msg}`),
  error: (msg: string) => console.error(`[${SERVER_NAME}] ERROR: ${msg}`),
};

// ─── Tool registry ───────────────────────────────────────────────────────────

/** All locally defined tool definitions (excludes dynamic upstream tools). */
const ALL_LOCAL_TOOLS: readonly ToolDefinition[] = [
  ...upstreamToolDefinitions,
  ...codeToolDefinitions,
  ...workspaceToolDefinitions,
  ...designToolDefinitions,
  ...analysisToolDefinitions,
  ...exportToolDefinitions,
];

/** Set of tool names that require a projectId argument. */
const TOOLS_REQUIRING_PROJECT = new Set([
  "get_project",
  "list_screens",
  "get_screen",
  "generate_screen_from_text",
  "edit_screens",
  "generate_variants",
  "get_screen_code",
  "get_screen_image",
  "build_site",
  "extract_design_context",
  "apply_design_context",
  "generate_design_tokens",
  "generate_responsive_variant",
  "batch_generate_screens",
  "analyze_accessibility",
  "compare_designs",
  "extract_components",
  "generate_style_guide",
  "export_design_system",
  "suggest_trending_design",
]);

/** Lookup sets for each tool category. */
const CODE_TOOL_NAMES = new Set(codeToolDefinitions.map((t) => t.name));
const WORKSPACE_TOOL_NAMES = new Set(workspaceToolDefinitions.map((t) => t.name));
const DESIGN_TOOL_NAMES = new Set(designToolDefinitions.map((t) => t.name));
const ANALYSIS_TOOL_NAMES = new Set(analysisToolDefinitions.map((t) => t.name));
const EXPORT_TOOL_NAMES = new Set(exportToolDefinitions.map((t) => t.name));

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);

  // Resolve authentication
  let creds: AuthCredentials;
  try {
    creds = resolveAuth();
  } catch (err: any) {
    log.error(err.message);
    process.exit(1);
  }

  // Create the MCP server
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // ── ListTools handler ────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Merge upstream tools (discovered dynamically) with local definitions.
    // Local definitions take precedence for tools we define locally.
    const localNames = new Set(ALL_LOCAL_TOOLS.map((t) => t.name));

    let upstreamOnlyTools: ToolDefinition[] = [];
    try {
      const upstream = await listUpstreamTools(creds, creds.projectId);
      upstreamOnlyTools = upstream.filter((t: any) => !localNames.has(t.name));
    } catch {
      // upstream unavailable — still expose local tools
    }

    return { tools: [...ALL_LOCAL_TOOLS, ...upstreamOnlyTools] };
  });

  // ── CallTool handler ─────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name } = request.params;
    let args = (request.params.arguments ?? {}) as Record<string, unknown>;

    // Auto-resolve project ID for tools that need it
    if (TOOLS_REQUIRING_PROJECT.has(name)) {
      const resolved = resolveProjectId(args.projectId as string | undefined);
      if (!resolved.projectId) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "PROJECT_REQUIRED",
                  message:
                    "No project is set. Use list_projects to find a project, then pass projectId or use set_workspace_project to save it.",
                  suggestions: [
                    { action: "list_projects", description: "List available projects" },
                    { action: "set_workspace_project", description: "Save a project to workspace" },
                  ],
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        } as McpToolResult;
      }

      if (!args.projectId) {
        args = { ...args, projectId: resolved.projectId };
        if (resolved.source !== "argument") {
          log.info(`Auto-using project: ${resolved.projectName ?? resolved.projectId} (${resolved.source})`);
        }
      }
    }

    const pid = creds.projectId;

    // Route to appropriate handler
    if (WORKSPACE_TOOL_NAMES.has(name)) {
      return await handleWorkspaceTool(name, args);
    }
    if (CODE_TOOL_NAMES.has(name)) {
      return await handleCodeTool(name, args, creds, ALL_LOCAL_TOOLS, pid);
    }
    if (DESIGN_TOOL_NAMES.has(name)) {
      return await handleDesignTool(name, args, creds, pid);
    }
    if (ANALYSIS_TOOL_NAMES.has(name)) {
      return await handleAnalysisTool(name, args, creds, pid);
    }
    if (EXPORT_TOOL_NAMES.has(name)) {
      return await handleExportTool(name, args, creds, pid);
    }

    // Upstream tools (including any dynamically discovered ones)
    return await handleUpstreamTool(name, args, creds, pid);
  });

  // ── Start transport ──────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("MCP server running on stdio");
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] Fatal: ${err.message}`);
  process.exit(1);
});
