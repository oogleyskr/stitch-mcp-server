/**
 * Export tools — generate style guides, export design systems, and apply trending designs.
 *
 * Ported from GreenSheep01201/stitch-mcp-auto export and trends tools.
 */

import type { ToolDefinition, McpToolResult, AuthCredentials } from "../types";
import { callUpstreamTool, fetchScreenHtml, findDownloadUrl, findImageUrl, downloadText, downloadBase64 } from "../stitch-client";

/** Tool definitions for export tools. */
export const exportToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "generate_style_guide",
    description:
      "Generates a comprehensive style guide / design documentation screen from an existing design. Creates a visual reference of colors, typography, components, and usage guidelines.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenId: { type: "string", description: "The source screen ID." },
        sections: {
          type: "array",
          items: { type: "string", enum: ["colors", "typography", "spacing", "components", "icons", "guidelines"] },
          description: "Sections to include.",
          default: ["colors", "typography", "spacing", "components"],
        },
        format: { type: "string", enum: ["visual", "documentation", "both"], description: "Output format.", default: "visual" },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "export_design_system",
    description:
      "Exports a complete design system package from project screens including tokens, components, documentation, and assets. Ready for developer handoff.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenIds: { type: "array", items: { type: "string" }, description: "Screen IDs to include (leave empty for all)." },
        includeTokens: { type: "boolean", description: "Include design tokens.", default: true },
        includeComponents: { type: "boolean", description: "Include component definitions.", default: true },
        includeDocumentation: { type: "boolean", description: "Include usage documentation.", default: true },
        tokenFormat: { type: "string", enum: ["css-variables", "tailwind", "json", "scss"], description: "Token format.", default: "css-variables" },
        componentFormat: { type: "string", enum: ["react", "vue", "html", "json"], description: "Component format.", default: "react" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "suggest_trending_design",
    description:
      "Suggests and applies modern UI/UX design trends to a screen prompt. Includes glassmorphism, bento-grid, gradient meshes, micro-interactions, and more.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        prompt: { type: "string", description: "Base screen description." },
        trends: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "glassmorphism", "bento-grid", "gradient-mesh", "aurora-gradients",
              "3d-elements", "micro-interactions", "dark-mode", "minimalist",
              "brutalist", "neomorphism", "retro-futurism", "organic-shapes", "bold-typography",
            ],
          },
          description: "Design trends to apply.",
        },
        intensity: { type: "string", enum: ["subtle", "moderate", "bold"], description: "Trend intensity.", default: "moderate" },
        deviceType: { type: "string", enum: ["MOBILE", "DESKTOP", "TABLET"], description: "Target device.", default: "MOBILE" },
      },
      required: ["projectId", "prompt", "trends"],
    },
  },
  {
    name: "export_all_screens",
    description:
      "Exports all screens from a Stitch project. Fetches each screen's HTML code and screenshot, returning a complete project export as structured data. Useful for backing up or migrating designs.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        includeHtml: { type: "boolean", description: "Include HTML code for each screen.", default: true },
        includeScreenshots: { type: "boolean", description: "Include base64 screenshots for each screen.", default: true },
        maxScreens: { type: "number", description: "Maximum number of screens to export (0 = all).", default: 0 },
      },
      required: ["projectId"],
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCssValues(html: string, property: string): string[] {
  const regex = new RegExp(`${property}:\\s*([^;]+)`, "gi");
  const matches = html.match(regex) ?? [];
  return [...new Set(matches.map((m) => m.split(":")[1]?.trim()).filter(Boolean))];
}

// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleGenerateStyleGuide(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const sections = (args.sections as string[]) ?? ["colors", "typography", "spacing", "components"];
  const format = (args.format as string) ?? "visual";

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  const colors = [...new Set(html.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [])].slice(0, 10);
  const fonts = extractCssValues(html, "font-family");
  const sizes = extractCssValues(html, "font-size");
  const spacings = extractCssValues(html, "(margin|padding)").slice(0, 8);

  // Documentation format
  if (format === "documentation" || format === "both") {
    let doc = "# Style Guide\n\n";
    if (sections.includes("colors")) {
      doc += "## Colors\n\n";
      colors.forEach((c, i) => { doc += `- **Color ${i + 1}**: \`${c}\`\n`; });
      doc += "\n";
    }
    if (sections.includes("typography")) {
      doc += "## Typography\n\n### Font Families\n";
      fonts.forEach((f) => { doc += `- ${f}\n`; });
      doc += "\n### Font Sizes\n";
      sizes.forEach((s) => { doc += `- ${s}\n`; });
      doc += "\n";
    }
    if (sections.includes("spacing")) {
      doc += "## Spacing\n\n";
      spacings.forEach((s, i) => { doc += `- **Space ${i + 1}**: ${s}\n`; });
      doc += "\n";
    }
    if (format === "documentation") {
      return { content: [{ type: "text", text: doc }] };
    }
  }

  // Visual format — generate a style guide screen via Stitch
  const sectionPrompts: string[] = [];
  if (sections.includes("colors")) sectionPrompts.push(`Color palette section showing these colors: ${colors.slice(0, 6).join(", ")}`);
  if (sections.includes("typography")) sectionPrompts.push("Typography section showing font samples with different sizes and weights");
  if (sections.includes("spacing")) sectionPrompts.push("Spacing scale visualization");
  if (sections.includes("components")) sectionPrompts.push("Component library showing buttons, inputs, cards in different states");

  const styleGuidePrompt = `Create a comprehensive style guide / design system documentation page with:\n\n${sectionPrompts.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nUse a clean, organized layout with clear section headers. This should serve as a visual reference for developers and designers.`;

  const result = await callUpstreamTool(
    "generate_screen_from_text",
    { projectId: pid, prompt: styleGuidePrompt, deviceType: "DESKTOP" },
    creds,
    projectId
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { success: true, message: "Style guide generated", extractedElements: { colors: colors.length, fonts: fonts.length, spacings: spacings.length }, sections, result },
          null,
          2
        ),
      },
    ],
  };
}

async function handleExportDesignSystem(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  let screenIds = (args.screenIds as string[]) ?? [];
  const includeTokens = args.includeTokens !== false;
  const includeComponents = args.includeComponents !== false;
  const includeDocumentation = args.includeDocumentation !== false;
  const tokenFormat = (args.tokenFormat as string) ?? "css-variables";

  // If no screen IDs provided, try to list screens
  if (screenIds.length === 0) {
    try {
      const listRes = await callUpstreamTool("list_screens", { projectId: pid }, creds, projectId);
      const listStr = JSON.stringify(listRes);
      const matches = listStr.match(/screenId['"]\s*:\s*['"]([^'"]+)/g);
      if (matches) {
        screenIds = matches.map((m) => m.split(/['"]/)[2]).filter(Boolean).slice(0, 5);
      }
    } catch {
      // proceed with empty list
    }
  }

  const exportPackage: {
    projectId: string;
    exportedAt: string;
    screens: number;
    tokens: string | Record<string, unknown> | null;
    components: Array<{ type: string; source: string; html: string }>;
    documentation: string | null;
  } = {
    projectId: pid,
    exportedAt: new Date().toISOString(),
    screens: screenIds.length,
    tokens: null,
    components: [],
    documentation: null,
  };

  // Extract tokens from first screen
  if (includeTokens && screenIds.length > 0) {
    try {
      const html = await fetchScreenHtml(pid, screenIds[0], creds, projectId);
      const colors = [...new Set(html.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [])].slice(0, 10);
      const sizes = extractCssValues(html, "font-size").slice(0, 6);
      const spacings = extractCssValues(html, "(margin|padding|gap)").slice(0, 8);
      const radii = extractCssValues(html, "border-radius").slice(0, 4);

      if (tokenFormat === "css-variables") {
        let css = `:root {\n`;
        colors.forEach((c, i) => { css += `  --color-${i + 1}: ${c};\n`; });
        sizes.forEach((s, i) => { css += `  --font-size-${i + 1}: ${s};\n`; });
        spacings.forEach((s, i) => { css += `  --spacing-${i + 1}: ${s};\n`; });
        radii.forEach((r, i) => { css += `  --radius-${i + 1}: ${r};\n`; });
        css += `}\n`;
        exportPackage.tokens = css;
      } else {
        exportPackage.tokens = { colors, fontSizes: sizes, spacing: spacings, borderRadius: radii };
      }
    } catch {
      // token extraction failed — proceed without
    }
  }

  // Extract components
  if (includeComponents && screenIds.length > 0) {
    for (const sid of screenIds.slice(0, 3)) {
      try {
        const html = await fetchScreenHtml(pid, sid, creds, projectId);
        const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) ?? [];
        buttons.slice(0, 2).forEach((btn) => {
          exportPackage.components.push({ type: "button", source: sid, html: btn });
        });
      } catch {
        // skip this screen
      }
    }
  }

  // Documentation
  if (includeDocumentation) {
    const tokenBlock =
      typeof exportPackage.tokens === "string"
        ? "```css\n" + exportPackage.tokens + "\n```"
        : "```json\n" + JSON.stringify(exportPackage.tokens, null, 2) + "\n```";

    exportPackage.documentation = `# Design System Export

## Project: ${pid}
## Exported: ${exportPackage.exportedAt}

### Tokens
${tokenBlock}

### Components
${exportPackage.components.length} components extracted.

### Usage
1. Import tokens into your project
2. Use component patterns as reference
3. Maintain consistency with extracted values
`;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { success: true, message: `Design system exported from ${screenIds.length} screen(s)`, package: exportPackage },
          null,
          2
        ),
      },
    ],
  };
}

async function handleSuggestTrendingDesign(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const prompt = args.prompt as string;
  const trends = args.trends as string[];
  const intensity = (args.intensity as string) ?? "moderate";
  const deviceType = (args.deviceType as string) ?? "MOBILE";

  const trendDescriptions: Record<string, string> = {
    glassmorphism: "frosted glass effect with backdrop blur, semi-transparent backgrounds, subtle borders",
    "bento-grid": "asymmetric grid layout with varied card sizes, Japanese-inspired minimalist organization",
    "gradient-mesh": "complex multi-color gradient backgrounds with smooth color transitions",
    "aurora-gradients": "flowing, aurora borealis-inspired gradient animations",
    "3d-elements": "subtle 3D transforms, depth, and perspective effects",
    "micro-interactions": "small animated feedback on hover, click, and state changes",
    "dark-mode": "dark color scheme with high contrast accents, reduced eye strain",
    minimalist: "clean, uncluttered design with generous whitespace",
    brutalist: "raw, bold typography, stark contrasts, intentionally unpolished aesthetic",
    neomorphism: "soft UI with subtle shadows creating extruded/pressed effect",
    "retro-futurism": "blend of vintage aesthetics with futuristic elements, neon accents",
    "organic-shapes": "fluid, blob-like shapes and curved elements",
    "bold-typography": "large, impactful typography as the main visual element",
  };

  const intensityModifiers: Record<string, string> = {
    subtle: "Use these styles subtly and sparingly — hints and accents only.",
    moderate: "Apply these styles as notable design features while maintaining usability.",
    bold: "Make these styles the dominant visual language — dramatic and immersive.",
  };

  const selectedTrends = trends.map((t) => trendDescriptions[t]).filter(Boolean);

  const enhancedPrompt = `${prompt}

DESIGN DIRECTION — Apply modern UI/UX trends:
${selectedTrends.map((t, i) => `${i + 1}. ${t}`).join("\n")}

INTENSITY: ${intensityModifiers[intensity] ?? intensityModifiers.moderate}

Create a visually striking, modern design that feels fresh and contemporary while maintaining excellent usability.`;

  const result = await callUpstreamTool(
    "generate_screen_from_text",
    { projectId: pid, prompt: enhancedPrompt, deviceType },
    creds,
    projectId
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { success: true, message: "Trending design generated", appliedTrends: trends, intensity, result },
          null,
          2
        ),
      },
    ],
  };
}


async function handleExportAllScreens(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const includeHtml = args.includeHtml !== false;
  const includeScreenshots = args.includeScreenshots !== false;
  const maxScreens = (args.maxScreens as number) ?? 0;

  // List all screens
  let screenList: Array<{ screenId: string; name?: string }> = [];
  try {
    const listRes = await callUpstreamTool("list_screens", { projectId: pid }, creds, projectId);
    const listStr = JSON.stringify(listRes);
    // Parse screen IDs and names from the response
    const screenMatches = listStr.match(/"screenId"\s*:\s*"([^"]+)"/g);
    const nameMatches = listStr.match(/"name"\s*:\s*"([^"]+)"/g);
    if (screenMatches) {
      screenList = screenMatches.map((m, i) => ({
        screenId: m.match(/"([^"]+)"$/)?.[1] ?? "",
        name: nameMatches?.[i]?.match(/"([^"]+)"$/)?.[1] ?? undefined,
      })).filter((s) => s.screenId);
    }
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Failed to list screens: ${err.message}` }],
      isError: true,
    };
  }

  if (screenList.length === 0) {
    return {
      content: [{ type: "text", text: "No screens found in the project." }],
      isError: true,
    };
  }

  // Apply limit
  const screensToExport = maxScreens > 0 ? screenList.slice(0, maxScreens) : screenList;

  const exportedScreens: Array<{
    screenId: string;
    name?: string;
    html?: string;
    screenshot?: string;
    error?: string;
  }> = [];

  for (const screen of screensToExport) {
    const entry: typeof exportedScreens[0] = {
      screenId: screen.screenId,
      name: screen.name,
    };

    try {
      const screenResult = await callUpstreamTool(
        "get_screen",
        { projectId: pid, screenId: screen.screenId },
        creds,
        projectId
      );

      if (includeHtml) {
        const downloadUrl = findDownloadUrl(screenResult);
        if (downloadUrl) {
          entry.html = await downloadText(downloadUrl);
        }
      }

      if (includeScreenshots) {
        const imageUrl = findImageUrl(screenResult);
        if (imageUrl) {
          entry.screenshot = await downloadBase64(imageUrl);
        }
      }
    } catch (err: any) {
      entry.error = err.message;
    }

    exportedScreens.push(entry);
  }

  const successCount = exportedScreens.filter((s) => !s.error).length;
  const failCount = exportedScreens.filter((s) => s.error).length;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            projectId: pid,
            exportedAt: new Date().toISOString(),
            summary: {
              totalScreens: screenList.length,
              exported: successCount,
              failed: failCount,
              includesHtml: includeHtml,
              includesScreenshots: includeScreenshots,
            },
            screens: exportedScreens,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Dispatches an export tool call.
 */
export async function handleExportTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "generate_style_guide":
        return await handleGenerateStyleGuide(args, creds, projectId);
      case "export_design_system":
        return await handleExportDesignSystem(args, creds, projectId);
      case "suggest_trending_design":
        return await handleSuggestTrendingDesign(args, creds, projectId);
      case "export_all_screens":
        return await handleExportAllScreens(args, creds, projectId);
      default:
        return { content: [{ type: "text", text: `Unknown export tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}
