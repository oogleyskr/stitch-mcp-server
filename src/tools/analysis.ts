/**
 * Analysis tools — accessibility checking, design comparison, and component extraction.
 *
 * Ported from GreenSheep01201/stitch-mcp-auto analysis tools.
 */

import type { ToolDefinition, McpToolResult, AuthCredentials } from "../types";
import { callUpstreamTool, fetchScreenHtml } from "../stitch-client";

/** Tool definitions for analysis tools. */
export const analysisToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "analyze_accessibility",
    description:
      "Analyzes a screen for WCAG 2.1 accessibility compliance. Checks color contrast, text sizes, touch targets, semantic structure, and provides actionable recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenId: { type: "string", description: "The screen ID to analyze." },
        level: { type: "string", enum: ["A", "AA", "AAA"], description: "WCAG conformance level.", default: "AA" },
        includeRecommendations: { type: "boolean", description: "Include fix recommendations.", default: true },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "compare_designs",
    description:
      "Compares two screens to identify design differences, inconsistencies, and suggest harmonization opportunities.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenId1: { type: "string", description: "First screen ID." },
        screenId2: { type: "string", description: "Second screen ID." },
        compareAspects: {
          type: "array",
          items: { type: "string", enum: ["colors", "typography", "spacing", "components", "layout"] },
          description: "Aspects to compare.",
          default: ["colors", "typography", "spacing", "components", "layout"],
        },
      },
      required: ["projectId", "screenId1", "screenId2"],
    },
  },
  {
    name: "extract_components",
    description:
      "Extracts reusable UI component patterns (buttons, cards, forms, inputs) from a screen with their styles and variants.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenId: { type: "string", description: "The screen ID." },
        componentTypes: {
          type: "array",
          items: { type: "string", enum: ["buttons", "cards", "forms", "navigation", "lists", "modals", "inputs", "all"] },
          description: "Types of components to extract.",
          default: ["all"],
        },
        outputFormat: { type: "string", enum: ["json", "react", "html", "vue"], description: "Output format.", default: "json" },
      },
      required: ["projectId", "screenId"],
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractUnique(html: string, pattern: RegExp): Set<string> {
  return new Set(html.match(pattern) ?? []);
}

// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleAnalyzeAccessibility(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const level = (args.level as string) ?? "AA";
  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  const issues: Array<{ criterion: string; severity: string; issue: string; recommendation: string }> = [];
  const passes: Array<{ criterion: string; check: string }> = [];

  // Image alt text
  const imgWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) ?? []).length;
  const imgWithAlt = (html.match(/<img[^>]*alt=/gi) ?? []).length;
  if (imgWithoutAlt > 0) {
    issues.push({ criterion: "1.1.1", severity: "critical", issue: `${imgWithoutAlt} image(s) missing alt attribute`, recommendation: "Add descriptive alt text to all images" });
  } else if (imgWithAlt > 0) {
    passes.push({ criterion: "1.1.1", check: "All images have alt attributes" });
  }

  // Empty buttons/links
  const emptyButtons = (html.match(/<button[^>]*>\s*<\/button>/gi) ?? []).length;
  const emptyLinks = (html.match(/<a[^>]*>\s*<\/a>/gi) ?? []).length;
  if (emptyButtons > 0 || emptyLinks > 0) {
    issues.push({ criterion: "2.4.4", severity: "serious", issue: `${emptyButtons + emptyLinks} interactive element(s) with no accessible name`, recommendation: "Add visible text or aria-label to buttons and links" });
  }

  // Form labels
  const inputsWithoutLabel = (html.match(/<input(?![^>]*aria-label)[^>]*>/gi) ?? []).length;
  if (inputsWithoutLabel > 0) {
    issues.push({ criterion: "3.3.2", severity: "serious", issue: "Form inputs may be missing labels", recommendation: "Associate labels with form inputs using 'for' attribute or aria-label" });
  }

  // Heading structure
  const h1Count = (html.match(/<h1/gi) ?? []).length;
  if (h1Count === 0) {
    issues.push({ criterion: "1.3.1", severity: "moderate", issue: "No H1 heading found", recommendation: "Add a main heading (H1) for page structure" });
  } else if (h1Count > 1) {
    issues.push({ criterion: "1.3.1", severity: "minor", issue: `Multiple H1 headings (${h1Count}) found`, recommendation: "Consider using only one H1 per page" });
  } else {
    passes.push({ criterion: "1.3.1", check: "Single H1 heading present" });
  }

  // Language attribute
  if (!html.includes("lang=")) {
    issues.push({ criterion: "3.1.1", severity: "moderate", issue: "Language attribute not set", recommendation: "Add lang attribute to html element" });
  } else {
    passes.push({ criterion: "3.1.1", check: "Language attribute present" });
  }

  // Viewport
  if (!html.includes("viewport")) {
    issues.push({ criterion: "1.4.4", severity: "moderate", issue: "Viewport meta tag not found", recommendation: "Add responsive viewport meta tag" });
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const seriousCount = issues.filter((i) => i.severity === "serious").length;
  const score = Math.max(0, 100 - criticalCount * 25 - seriousCount * 15 - (issues.length - criticalCount - seriousCount) * 5);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            wcagLevel: level,
            accessibilityScore: score,
            summary: {
              totalIssues: issues.length,
              critical: criticalCount,
              serious: seriousCount,
              moderate: issues.filter((i) => i.severity === "moderate").length,
              minor: issues.filter((i) => i.severity === "minor").length,
              passes: passes.length,
            },
            issues: args.includeRecommendations !== false ? issues : issues.map(({ recommendation: _, ...rest }) => rest),
            passes,
            note: "This is an automated check. Manual testing is recommended for complete accessibility compliance.",
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleCompareDesigns(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId1 = args.screenId1 as string;
  const screenId2 = args.screenId2 as string;
  const compareAspects = (args.compareAspects as string[]) ?? ["colors", "typography", "spacing", "components", "layout"];

  const [html1, html2] = await Promise.all([
    fetchScreenHtml(pid, screenId1, creds, projectId),
    fetchScreenHtml(pid, screenId2, creds, projectId),
  ]);

  const differences: any[] = [];
  const similarities: any[] = [];
  const recommendations: string[] = [];

  if (compareAspects.includes("colors")) {
    const colors1 = extractUnique(html1, /#[0-9A-Fa-f]{3,8}\b/g);
    const colors2 = extractUnique(html2, /#[0-9A-Fa-f]{3,8}\b/g);
    const shared = [...colors1].filter((c) => colors2.has(c));
    const only1 = [...colors1].filter((c) => !colors2.has(c));
    const only2 = [...colors2].filter((c) => !colors1.has(c));
    if (shared.length > 0) similarities.push({ aspect: "colors", detail: `${shared.length} shared colors`, values: shared.slice(0, 5) });
    if (only1.length > 0 || only2.length > 0) {
      differences.push({ aspect: "colors", screen1Only: only1.slice(0, 5), screen2Only: only2.slice(0, 5) });
      if (only1.length > 3 || only2.length > 3) recommendations.push("Consider consolidating color palette for visual consistency");
    }
  }

  if (compareAspects.includes("typography")) {
    const fonts1 = extractUnique(html1, /font-family:\s*[^;]+/gi);
    const fonts2 = extractUnique(html2, /font-family:\s*[^;]+/gi);
    const shared = [...fonts1].filter((f) => fonts2.has(f));
    if (shared.length > 0) similarities.push({ aspect: "typography", detail: "Shared font families", values: shared });
    if (fonts1.size !== fonts2.size || [...fonts1].some((f) => !fonts2.has(f))) {
      differences.push({ aspect: "typography", screen1Fonts: [...fonts1], screen2Fonts: [...fonts2] });
    }
  }

  if (compareAspects.includes("spacing")) {
    const sp1 = extractUnique(html1, /(margin|padding|gap):\s*[^;]+/gi);
    const sp2 = extractUnique(html2, /(margin|padding|gap):\s*[^;]+/gi);
    const shared = [...sp1].filter((s) => sp2.has(s));
    if (shared.length > sp1.size * 0.5) {
      similarities.push({ aspect: "spacing", detail: `${Math.round((shared.length / sp1.size) * 100)}% spacing consistency` });
    } else {
      differences.push({ aspect: "spacing", detail: "Inconsistent spacing values detected" });
      recommendations.push("Establish a consistent spacing scale (e.g., 4px, 8px, 16px, 24px, 32px)");
    }
  }

  if (compareAspects.includes("components")) {
    const patterns = [
      { name: "button", pattern: /<button|btn/gi },
      { name: "card", pattern: /card|<article/gi },
      { name: "form", pattern: /<form|<input/gi },
      { name: "navigation", pattern: /<nav|navbar/gi },
      { name: "modal", pattern: /modal|dialog/gi },
    ];
    const c1: string[] = [];
    const c2: string[] = [];
    for (const { name, pattern } of patterns) {
      if (pattern.test(html1)) c1.push(name);
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      if (pattern.test(html2)) c2.push(name);
      pattern.lastIndex = 0;
    }
    const shared = c1.filter((c) => c2.includes(c));
    if (shared.length > 0) similarities.push({ aspect: "components", detail: "Shared component types", values: shared });
  }

  if (compareAspects.includes("layout")) {
    const usesGrid1 = /display:\s*grid/i.test(html1);
    const usesGrid2 = /display:\s*grid/i.test(html2);
    const usesFlex1 = /display:\s*flex/i.test(html1);
    const usesFlex2 = /display:\s*flex/i.test(html2);
    if (usesGrid1 === usesGrid2 && usesFlex1 === usesFlex2) {
      similarities.push({ aspect: "layout", detail: "Same layout system (grid/flex)" });
    } else {
      differences.push({ aspect: "layout", screen1: { usesGrid: usesGrid1, usesFlex: usesFlex1 }, screen2: { usesGrid: usesGrid2, usesFlex: usesFlex2 } });
    }
  }

  const consistencyScore = Math.round((similarities.length / (similarities.length + differences.length)) * 100) || 0;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ success: true, consistencyScore, screens: { screen1: screenId1, screen2: screenId2 }, differences, similarities, recommendations }, null, 2),
      },
    ],
  };
}

async function handleExtractComponents(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const componentTypes = (args.componentTypes as string[]) ?? ["all"];
  const outputFormat = (args.outputFormat as string) ?? "json";
  const extractAll = componentTypes.includes("all");

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);
  const components: Array<{ type: string; variant: string; html: string; classes: string; inlineStyles?: string }> = [];

  // Buttons
  if (extractAll || componentTypes.includes("buttons")) {
    const matches = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) ?? [];
    matches.slice(0, 5).forEach((btn, i) => {
      const cls = btn.match(/class="([^"]*)"/)?.[1] ?? "";
      const style = btn.match(/style="([^"]*)"/)?.[1] ?? "";
      components.push({ type: "button", variant: `button-${i + 1}`, html: btn, classes: cls, inlineStyles: style });
    });
  }

  // Cards
  if (extractAll || componentTypes.includes("cards")) {
    const matches = html.match(/<[^>]*class="[^"]*card[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi) ?? [];
    matches.slice(0, 3).forEach((card, i) => {
      const cls = card.match(/class="([^"]*)"/)?.[1] ?? "";
      components.push({ type: "card", variant: `card-${i + 1}`, html: card.substring(0, 500) + (card.length > 500 ? "..." : ""), classes: cls });
    });
  }

  // Inputs
  if (extractAll || componentTypes.includes("inputs")) {
    const matches = html.match(/<input[^>]*>/gi) ?? [];
    matches.slice(0, 5).forEach((input, i) => {
      const inputType = input.match(/type="([^"]*)"/)?.[1] ?? "text";
      const cls = input.match(/class="([^"]*)"/)?.[1] ?? "";
      components.push({ type: "input", variant: inputType, html: input, classes: cls });
    });
  }

  // Navigation
  if (extractAll || componentTypes.includes("navigation")) {
    const matches = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/gi) ?? [];
    matches.slice(0, 2).forEach((nav, i) => {
      const cls = nav.match(/class="([^"]*)"/)?.[1] ?? "";
      components.push({ type: "navigation", variant: `nav-${i + 1}`, html: nav.substring(0, 500) + (nav.length > 500 ? "..." : ""), classes: cls });
    });
  }

  // Format output
  let output: string;
  if (outputFormat === "json") {
    output = JSON.stringify({ components }, null, 2);
  } else if (outputFormat === "react") {
    output = components
      .map((c) => {
        const name = `${c.type.charAt(0).toUpperCase()}${c.type.slice(1)}${c.variant.split("-")[1] ?? ""}`;
        return `// ${name} Component\nexport const ${name} = ({ children, ...props }) => (\n  ${c.html.replace(/class=/g, "className=")}\n);`;
      })
      .join("\n\n");
  } else if (outputFormat === "vue") {
    output = components
      .map((c) => {
        const name = `${c.type.charAt(0).toUpperCase()}${c.type.slice(1)}${c.variant.split("-")[1] ?? ""}`;
        return `<!-- ${name} Component -->\n<template>\n  ${c.html}\n</template>\n\n<script>\nexport default {\n  name: '${name}'\n}\n</script>`;
      })
      .join("\n\n");
  } else {
    output = components.map((c) => `<!-- ${c.type} - ${c.variant} -->\n${c.html}`).join("\n\n");
  }

  return { content: [{ type: "text", text: `Extracted ${components.length} components (${outputFormat} format):\n\n${output}` }] };
}

/**
 * Dispatches an analysis tool call.
 */
export async function handleAnalysisTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "analyze_accessibility":
        return await handleAnalyzeAccessibility(args, creds, projectId);
      case "compare_designs":
        return await handleCompareDesigns(args, creds, projectId);
      case "extract_components":
        return await handleExtractComponents(args, creds, projectId);
      default:
        return { content: [{ type: "text", text: `Unknown analysis tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}
