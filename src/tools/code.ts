/**
 * Code & Build tools — fetch screen HTML/images and build multi-page sites.
 *
 * Inspired by davideast/stitch-mcp virtual tools:
 *   get_screen_code, get_screen_image, build_site, list_tools
 */

import type { ToolDefinition, McpToolResult, AuthCredentials } from "../types";
import {
  callUpstreamTool,
  listUpstreamTools,
  findDownloadUrl,
  findImageUrl,
  downloadText,
  downloadBase64,
} from "../stitch-client";

/** Tool definitions for code/build tools. */
export const codeToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "get_screen_code",
    description:
      "Retrieves the HTML code content of a screen. Returns the raw HTML that can be used for code generation or analysis.",
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
    name: "get_screen_image",
    description:
      "Retrieves the screenshot/preview image of a screen as base64-encoded PNG.",
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
    name: "build_site",
    description:
      "Builds a site from a Stitch project by mapping screens to routes. Returns the design HTML for each page to use as context for code generation.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        routes: {
          type: "array",
          description: "Array of screen-to-route mappings.",
          items: {
            type: "object",
            properties: {
              screenId: { type: "string", description: "The screen ID for this route." },
              route: { type: "string", description: 'The route path (e.g. "/" or "/about").' },
            },
            required: ["screenId", "route"],
          },
        },
      },
      required: ["projectId", "routes"],
    },
  },
  {
    name: "list_tools",
    description: "Lists all available tools with their descriptions and input schemas.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Handles the get_screen_code tool.
 */
async function handleGetScreenCode(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = (args.projectId as string) || "";
  const screenId = (args.screenId as string) || "";

  const result = await callUpstreamTool(
    "get_screen",
    { projectId: pid, screenId },
    creds,
    projectId
  );

  const downloadUrl = findDownloadUrl(result);
  if (!downloadUrl) {
    return {
      content: [{ type: "text", text: "No code download URL found in screen data." }],
      isError: true,
    };
  }

  const html = await downloadText(downloadUrl);
  return { content: [{ type: "text", text: html }] };
}

/**
 * Handles the get_screen_image tool.
 */
async function handleGetScreenImage(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = (args.projectId as string) || "";
  const screenId = (args.screenId as string) || "";

  const result = await callUpstreamTool(
    "get_screen",
    { projectId: pid, screenId },
    creds,
    projectId
  );

  const imageUrl = findImageUrl(result);
  if (!imageUrl) {
    return {
      content: [{ type: "text", text: "No image URL found in screen data." }],
      isError: true,
    };
  }

  const base64 = await downloadBase64(imageUrl);
  return {
    content: [
      { type: "text", text: `Screenshot for screen ${screenId}` },
      { type: "image", data: base64, mimeType: "image/png" },
    ],
  };
}

/**
 * Handles the build_site tool — fetches HTML for each route mapping.
 */
async function handleBuildSite(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = (args.projectId as string) || "";
  const routes = args.routes as Array<{ screenId: string; route: string }>;

  if (!Array.isArray(routes) || routes.length === 0) {
    return {
      content: [{ type: "text", text: "routes must be a non-empty array." }],
      isError: true,
    };
  }

  // Check for duplicate routes
  const routePaths = routes.map((r) => r.route);
  const uniqueRoutes = new Set(routePaths);
  if (uniqueRoutes.size !== routePaths.length) {
    return {
      content: [{ type: "text", text: "Duplicate route paths found." }],
      isError: true,
    };
  }

  const pages: Array<{
    screenId: string;
    route: string;
    html: string;
  }> = [];
  const errors: string[] = [];

  // Fetch HTML for each screen sequentially (avoids rate limits)
  for (const entry of routes) {
    try {
      const result = await callUpstreamTool(
        "get_screen",
        { projectId: pid, screenId: entry.screenId },
        creds,
        projectId
      );

      const downloadUrl = findDownloadUrl(result);
      const html = downloadUrl ? await downloadText(downloadUrl) : "";
      pages.push({ screenId: entry.screenId, route: entry.route, html });
    } catch (err: any) {
      errors.push(`${entry.screenId}: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: `Errors fetching screens: ${errors.join("; ")}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            pages,
            message: `Built ${pages.length} page(s) with design HTML`,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handles the list_tools tool — returns all available tools from upstream + custom.
 */
async function handleListTools(
  creds: AuthCredentials,
  allToolDefinitions: readonly ToolDefinition[],
  projectId?: string
): Promise<McpToolResult> {
  let upstreamTools: any[] = [];
  try {
    upstreamTools = await listUpstreamTools(creds, projectId);
  } catch {
    // upstream unavailable — still return local tools
  }

  const localTools = allToolDefinitions.map((t) => ({
    name: t.name,
    description: t.description,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { upstreamTools, localTools },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Dispatches a code/build tool call.
 *
 * @param name              - Tool name.
 * @param args              - Tool arguments.
 * @param creds             - Resolved auth credentials.
 * @param allToolDefinitions - All registered tool definitions (for list_tools).
 * @param projectId         - Optional project ID override.
 */
export async function handleCodeTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  allToolDefinitions: readonly ToolDefinition[],
  projectId?: string
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "get_screen_code":
        return await handleGetScreenCode(args, creds, projectId);
      case "get_screen_image":
        return await handleGetScreenImage(args, creds, projectId);
      case "build_site":
        return await handleBuildSite(args, creds, projectId);
      case "list_tools":
        return await handleListTools(creds, allToolDefinitions, projectId);
      default:
        return {
          content: [{ type: "text", text: `Unknown code tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}
