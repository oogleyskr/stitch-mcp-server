/**
 * Integration tools — bridge Stitch designs to external project management tools.
 *
 * Provides structured output suitable for creating issues in Plane, Linear,
 * Jira, or similar project management tools.
 */

import type { ToolDefinition, McpToolResult, AuthCredentials } from "../types";
import {
  callUpstreamTool,
  fetchScreenHtml,
  findImageUrl,
  downloadBase64,
} from "../stitch-client";

/** Tool definitions for integration tools. */
export const integrationToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "screen_to_plane_issue",
    description:
      "Creates a structured output from a Stitch screen suitable for creating a Plane (or similar PM tool) issue. Includes a title derived from the screen name, a description with the design preview as base64 image, an implementation checklist extracted from HTML components, and suggested labels. Bridges the Stitch-to-project-management workflow.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The screen ID." },
        screenName: {
          type: "string",
          description: "Human-readable screen name. Used for the issue title. If omitted, derived from screenId.",
        },
        workspaceSlug: {
          type: "string",
          description: "Optional Plane workspace slug for reference in the output.",
        },
        planeProjectId: {
          type: "string",
          description: "Optional Plane project ID for reference in the output.",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low", "none"],
          description: "Suggested priority for the issue.",
          default: "medium",
        },
        additionalContext: {
          type: "string",
          description: "Additional context or requirements to include in the issue description.",
        },
      },
      required: ["projectId", "screenId"],
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts an implementation checklist from HTML by detecting UI components and patterns.
 */
function extractChecklist(html: string): string[] {
  const checklist: string[] = [];

  // Layout
  if (/display:\s*flex|display:\s*grid/i.test(html)) {
    checklist.push("Set up layout structure (flexbox/grid)");
  }

  // Navigation
  if (/<nav/i.test(html)) {
    checklist.push("Implement navigation component");
  }
  if (/<header/i.test(html)) {
    checklist.push("Implement header section");
  }
  if (/<footer/i.test(html)) {
    checklist.push("Implement footer section");
  }

  // Hero / Banner
  if (/hero|banner/i.test(html)) {
    checklist.push("Build hero/banner section");
  }

  // Forms
  const formInputCount = (html.match(/<input/gi) ?? []).length;
  if (/<form/i.test(html) || formInputCount > 0) {
    checklist.push(`Implement form with ${formInputCount} input field(s)`);
    checklist.push("Add form validation");
  }

  // Buttons
  const buttonCount = (html.match(/<button/gi) ?? []).length;
  if (buttonCount > 0) {
    checklist.push(`Create ${buttonCount} button component(s) with click handlers`);
  }

  // Cards
  if (/card|<article/i.test(html)) {
    checklist.push("Build card component(s)");
  }

  // Images
  const imgCount = (html.match(/<img/gi) ?? []).length;
  if (imgCount > 0) {
    checklist.push(`Add ${imgCount} image(s) with proper alt text and loading`);
  }

  // Lists
  if (/<ul|<ol/i.test(html)) {
    checklist.push("Implement list component(s)");
  }

  // Tables
  if (/<table/i.test(html)) {
    checklist.push("Build data table component");
  }

  // Modals / Dialogs
  if (/modal|dialog/i.test(html)) {
    checklist.push("Implement modal/dialog component");
  }

  // Icons / SVG
  const svgCount = (html.match(/<svg/gi) ?? []).length;
  if (svgCount > 0) {
    checklist.push(`Integrate ${svgCount} icon(s)/SVG assets`);
  }

  // Links
  const linkCount = (html.match(/<a\s/gi) ?? []).length;
  if (linkCount > 0) {
    checklist.push(`Wire up ${linkCount} link(s)/navigation paths`);
  }

  // Responsive
  if (/media|@media|responsive/i.test(html)) {
    checklist.push("Implement responsive breakpoints");
  }

  // Always include common tasks
  checklist.push("Match design colors, typography, and spacing");
  checklist.push("Add accessibility attributes (aria-labels, roles)");
  checklist.push("Test across target viewports");

  return checklist;
}

/**
 * Suggests labels based on HTML content analysis.
 */
function suggestLabels(html: string): string[] {
  const labels: string[] = ["ui", "frontend", "design"];

  if (/<form|<input/i.test(html)) labels.push("forms");
  if (/<nav/i.test(html)) labels.push("navigation");
  if (/<table/i.test(html)) labels.push("data-display");
  if (/modal|dialog/i.test(html)) labels.push("interactive");
  if (/auth|login|sign-?in|sign-?up|register/i.test(html)) labels.push("auth");
  if (/dashboard|analytics|chart|graph/i.test(html)) labels.push("dashboard");
  if (/settings|preferences|config/i.test(html)) labels.push("settings");
  if (/profile|account|user/i.test(html)) labels.push("user-profile");
  if (/pricing|plan|subscription/i.test(html)) labels.push("pricing");

  return [...new Set(labels)];
}

/**
 * Estimates complexity based on HTML component count and depth.
 */
function estimateComplexity(html: string): { level: string; points: number; reasoning: string } {
  let score = 0;
  const reasons: string[] = [];

  const inputCount = (html.match(/<input/gi) ?? []).length;
  const buttonCount = (html.match(/<button/gi) ?? []).length;
  const elementCount = (html.match(/<[a-z]/gi) ?? []).length;

  if (inputCount > 5) { score += 3; reasons.push(`${inputCount} form inputs`); }
  else if (inputCount > 0) { score += 1; reasons.push(`${inputCount} form inputs`); }

  if (buttonCount > 3) { score += 2; reasons.push(`${buttonCount} buttons`); }
  else if (buttonCount > 0) { score += 1; }

  if (elementCount > 100) { score += 3; reasons.push("complex layout (100+ elements)"); }
  else if (elementCount > 50) { score += 2; reasons.push("moderate layout"); }
  else { score += 1; reasons.push("simple layout"); }

  if (/<table/i.test(html)) { score += 2; reasons.push("data table"); }
  if (/modal|dialog/i.test(html)) { score += 2; reasons.push("modal/dialog"); }
  if (/<form/i.test(html)) { score += 1; reasons.push("form handling"); }

  let level: string;
  let points: number;
  if (score <= 3) { level = "low"; points = 1; }
  else if (score <= 6) { level = "medium"; points = 3; }
  else if (score <= 9) { level = "high"; points = 5; }
  else { level = "very-high"; points = 8; }

  return { level, points, reasoning: reasons.join(", ") };
}

// ─── Tool handler ────────────────────────────────────────────────────────────

async function handleScreenToPlaneIssue(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const screenName = (args.screenName as string) ?? `Screen ${screenId}`;
  const workspaceSlug = args.workspaceSlug as string | undefined;
  const planeProjectId = args.planeProjectId as string | undefined;
  const priority = (args.priority as string) ?? "medium";
  const additionalContext = args.additionalContext as string | undefined;

  // Fetch screen HTML
  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  // Attempt to fetch screen image
  let imageBase64: string | null = null;
  try {
    const screenResult = await callUpstreamTool(
      "get_screen",
      { projectId: pid, screenId },
      creds,
      projectId
    );
    const imageUrl = findImageUrl(screenResult);
    if (imageUrl) {
      imageBase64 = await downloadBase64(imageUrl);
    }
  } catch {
    // Image fetch failed — proceed without it
  }

  // Analyze HTML
  const checklist = extractChecklist(html);
  const labels = suggestLabels(html);
  const complexity = estimateComplexity(html);

  // Build issue title
  const title = `Implement UI: ${screenName}`;

  // Build issue description (markdown)
  let description = `## Design Reference\n\n`;
  description += `**Stitch Screen:** \`${screenId}\` (Project: \`${pid}\`)\n\n`;

  if (imageBase64) {
    description += `### Design Preview\n\n`;
    description += `![${screenName} Design](data:image/png;base64,${imageBase64})\n\n`;
  }

  if (additionalContext) {
    description += `### Additional Context\n\n${additionalContext}\n\n`;
  }

  description += `### Implementation Checklist\n\n`;
  for (const item of checklist) {
    description += `- [ ] ${item}\n`;
  }

  description += `\n### Complexity\n\n`;
  description += `- **Level:** ${complexity.level}\n`;
  description += `- **Story points:** ${complexity.points}\n`;
  description += `- **Reasoning:** ${complexity.reasoning}\n`;

  // Build structured output
  const issueData: Record<string, unknown> = {
    title,
    description,
    priority,
    labels,
    estimate_points: complexity.points,
    complexity: complexity.level,
  };

  if (workspaceSlug) issueData.workspace_slug = workspaceSlug;
  if (planeProjectId) issueData.plane_project_id = planeProjectId;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            message: `Issue data prepared for "${screenName}"`,
            issue: issueData,
            hasDesignPreview: imageBase64 !== null,
            checklistItems: checklist.length,
            suggestedLabels: labels,
            note: "Use this structured data to create an issue in Plane, Linear, Jira, or your preferred project management tool.",
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Dispatches an integration tool call.
 */
export async function handleIntegrationTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "screen_to_plane_issue":
        return await handleScreenToPlaneIssue(args, creds, projectId);
      default:
        return { content: [{ type: "text", text: `Unknown integration tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}
