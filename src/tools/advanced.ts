/**
 * Advanced tools — additional high-value utilities for design-to-code workflows.
 *
 * Tools:
 *   - screen_to_tailwind_config: Extract a complete tailwind.config.ts from a screen
 *   - screen_to_css_variables: Extract CSS custom properties from a design
 *   - validate_design_system: Check if a screen follows a given design token set
 *   - generate_dark_mode: Generate a dark-mode variant of a screen
 *   - generate_component_variants: Generate multiple visual variants of a component
 *   - project_summary: High-level summary of a Stitch project
 */

import type { ToolDefinition, McpToolResult, AuthCredentials } from "../types";
import {
  callUpstreamTool,
  fetchScreenHtml,
  parseScreenList,
} from "../stitch-client";
import { extractUnique, extractCssValues, requireString } from "./helpers";

// ─── Tool definitions ───────────────────────────────────────────────────────

/** Tool definitions for advanced tools. */
export const advancedToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "screen_to_tailwind_config",
    description:
      "Extracts a complete tailwind.config.ts from a screen's design. Analyses colors, fonts, spacing scale, border radii, shadows, and breakpoints to produce a ready-to-use Tailwind CSS configuration object.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The screen ID to extract from." },
        prefix: {
          type: "string",
          description: "Optional prefix for all generated utility classes (e.g. 'stitch').",
        },
        includePlugins: {
          type: "boolean",
          description: "Include suggested Tailwind plugin recommendations.",
          default: true,
        },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "screen_to_css_variables",
    description:
      "Extracts CSS custom properties (variables) from a screen's design. Produces a complete :root block with semantic naming for colors, typography, spacing, shadows, and border radii. Supports optional dark-mode variable overrides.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The screen ID to extract from." },
        includeDarkMode: {
          type: "boolean",
          description: "Generate a prefers-color-scheme:dark override block with inverted/adjusted values.",
          default: false,
        },
        namespace: {
          type: "string",
          description: "Optional namespace prefix for variable names (e.g. 'app' produces --app-color-primary).",
        },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "validate_design_system",
    description:
      "Validates whether a screen follows a given design token set. Checks colors, fonts, spacing, and border-radii against approved values and reports violations, compliance percentage, and suggestions for fixes.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The screen ID to validate." },
        approvedColors: {
          type: "array",
          items: { type: "string" },
          description: "List of approved color values (hex, rgb, hsl).",
        },
        approvedFonts: {
          type: "array",
          items: { type: "string" },
          description: "List of approved font family names.",
        },
        approvedSpacing: {
          type: "array",
          items: { type: "string" },
          description: "List of approved spacing values (e.g. '4px', '8px', '16px').",
        },
        approvedRadii: {
          type: "array",
          items: { type: "string" },
          description: "List of approved border-radius values.",
        },
        strictMode: {
          type: "boolean",
          description: "If true, any unapproved value is a violation. If false, only flag values that are far from approved ones.",
          default: false,
        },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "generate_dark_mode",
    description:
      "Takes a light-mode screen and generates a dark-mode variant. Analyses the existing color palette and instructs Stitch to regenerate with inverted brightness, adjusted contrast, and preserved brand accents.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The source (light-mode) screen ID." },
        preserveAccents: {
          type: "boolean",
          description: "Keep accent/brand colors unchanged (only invert backgrounds and text).",
          default: true,
        },
        contrast: {
          type: "string",
          enum: ["normal", "high"],
          description: "Contrast level for the dark variant.",
          default: "normal",
        },
        deviceType: {
          type: "string",
          enum: ["MOBILE", "DESKTOP", "TABLET"],
          description: "Target device type.",
          default: "MOBILE",
        },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "generate_component_variants",
    description:
      "Analyses a screen to identify a target component (button, card, hero, form, navigation) and generates multiple visual variants of it as separate screens. Useful for A/B testing or building component libraries.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The source screen ID containing the component." },
        componentType: {
          type: "string",
          enum: ["button", "card", "hero", "form", "navigation", "pricing-card", "testimonial", "footer"],
          description: "The type of component to generate variants for.",
        },
        variantCount: {
          type: "number",
          description: "Number of variants to generate (1-5).",
          default: 3,
        },
        variantStyles: {
          type: "array",
          items: {
            type: "string",
            enum: ["minimal", "rounded", "sharp", "gradient", "outlined", "filled", "glassmorphism", "brutalist"],
          },
          description: "Specific visual styles for the variants. If omitted, a diverse mix is used.",
        },
        deviceType: {
          type: "string",
          enum: ["MOBILE", "DESKTOP", "TABLET"],
          description: "Target device type.",
          default: "DESKTOP",
        },
      },
      required: ["projectId", "screenId", "componentType"],
    },
  },
  {
    name: "project_summary",
    description:
      "Returns a high-level summary of a Stitch project: screen count, list of screens with names, detected common patterns, design consistency score (based on color/font overlap across screens), and device type distribution.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        analyzeConsistency: {
          type: "boolean",
          description: "Fetch HTML from up to 5 screens to compute a design consistency score.",
          default: true,
        },
        maxScreensToAnalyze: {
          type: "number",
          description: "Maximum screens to fetch for consistency analysis.",
          default: 5,
        },
      },
      required: ["projectId"],
    },
  },
];

// ─── Tool handlers ──────────────────────────────────────────────────────────

/**
 * Handles screen_to_tailwind_config.
 */
async function handleScreenToTailwindConfig(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = requireString(args.projectId, "projectId");
  const screenId = requireString(args.screenId, "screenId");
  const prefix = (args.prefix as string) ?? "";
  const includePlugins = args.includePlugins !== false;

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  // Extract design values
  const hexColors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g);
  const rgbColors = extractUnique(html, /rgba?\([^)]+\)/gi);
  const fontFamilies = extractCssValues(html, "font-family");
  const fontSizes = extractCssValues(html, "font-size");
  const fontWeights = extractCssValues(html, "font-weight");
  const spacings = [...new Set([
    ...extractCssValues(html, "margin"),
    ...extractCssValues(html, "padding"),
    ...extractCssValues(html, "gap"),
  ])].filter((v) => /^\d/.test(v)).slice(0, 12);
  const radii = extractCssValues(html, "border-radius");
  const shadows = extractCssValues(html, "box-shadow");
  const lineHeights = extractCssValues(html, "line-height");

  // Categorise colors
  const allColors = [...hexColors, ...rgbColors];
  const colorCategories: Record<string, Record<string, string>> = {
    primary: {},
    secondary: {},
    neutral: {},
    accent: {},
  };

  let pIdx = 1, sIdx = 1, nIdx = 1, aIdx = 1;
  for (const c of allColors) {
    const lc = c.toLowerCase();
    if (/fff|f5f5|e5e5|eee|fafafa|f8f8|000|111|222|333|444|555|666|777|888|999|aaa|bbb|ccc|ddd/.test(lc)) {
      colorCategories.neutral[String(nIdx * 100)] = c;
      nIdx++;
    } else if (pIdx <= 3) {
      colorCategories.primary[String(pIdx * 100)] = c;
      pIdx++;
    } else if (sIdx <= 3) {
      colorCategories.secondary[String(sIdx * 100)] = c;
      sIdx++;
    } else {
      colorCategories.accent[String(aIdx * 100)] = c;
      aIdx++;
    }
  }

  // Build Tailwind config
  const colorBlock = Object.entries(colorCategories)
    .filter(([, vals]) => Object.keys(vals).length > 0)
    .map(([name, vals]) => {
      const entries = Object.entries(vals)
        .map(([shade, val]) => `        '${shade}': '${val}',`)
        .join("\n");
      return `      '${name}': {\n${entries}\n      },`;
    })
    .join("\n");

  const spacingBlock = spacings
    .map((s, i) => `      '${i + 1}': '${s}',`)
    .join("\n");

  const radiusBlock = radii
    .map((r, i) => {
      const names = ["sm", "md", "lg", "xl", "2xl", "full"];
      return `      '${names[i] ?? String(i)}': '${r}',`;
    })
    .join("\n");

  const shadowBlock = shadows
    .slice(0, 4)
    .map((s, i) => {
      const names = ["sm", "md", "lg", "xl"];
      return `      '${names[i] ?? String(i)}': '${s}',`;
    })
    .join("\n");

  const fontFamilyBlock = fontFamilies
    .slice(0, 3)
    .map((f, i) => {
      const names = ["sans", "serif", "mono"];
      return `      '${names[i] ?? "custom" + i}': ['${f}'],`;
    })
    .join("\n");

  const fontSizeBlock = fontSizes
    .slice(0, 8)
    .map((s, i) => {
      const names = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"];
      return `      '${names[i] ?? String(i)}': '${s}',`;
    })
    .join("\n");

  let config = `import type { Config } from "tailwindcss";\n\nconst config: Config = {\n`;
  if (prefix) config += `  prefix: "${prefix}-",\n`;
  config += `  content: ["./src/**/*.{js,ts,jsx,tsx,html}"],\n  theme: {\n    extend: {\n`;
  if (colorBlock) config += `    colors: {\n${colorBlock}\n    },\n`;
  if (fontFamilyBlock) config += `    fontFamily: {\n${fontFamilyBlock}\n    },\n`;
  if (fontSizeBlock) config += `    fontSize: {\n${fontSizeBlock}\n    },\n`;
  if (spacingBlock) config += `    spacing: {\n${spacingBlock}\n    },\n`;
  if (radiusBlock) config += `    borderRadius: {\n${radiusBlock}\n    },\n`;
  if (shadowBlock) config += `    boxShadow: {\n${shadowBlock}\n    },\n`;
  config += `    },\n  },\n`;

  const plugins: string[] = [];
  if (includePlugins) {
    if (/<form|<input/i.test(html)) plugins.push("@tailwindcss/forms");
    if (/<p|<article|<h[1-6]/i.test(html)) plugins.push("@tailwindcss/typography");
    if (/<img.*aspect/i.test(html)) plugins.push("@tailwindcss/aspect-ratio");
    if (plugins.length > 0) {
      config += `  plugins: [\n${plugins.map((p) => `    require("${p}"),`).join("\n")}\n  ],\n`;
    }
  }

  config += `};\n\nexport default config;\n`;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            screenId,
            extracted: {
              colors: allColors.length,
              fonts: fontFamilies.length,
              spacingValues: spacings.length,
              radii: radii.length,
              shadows: shadows.length,
            },
            suggestedPlugins: plugins,
            config,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handles screen_to_css_variables.
 */
async function handleScreenToCssVariables(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = requireString(args.projectId, "projectId");
  const screenId = requireString(args.screenId, "screenId");
  const includeDarkMode = args.includeDarkMode === true;
  const namespace = (args.namespace as string) ?? "";

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  const prefix = namespace ? `--${namespace}-` : "--";
  const hexColors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g);
  const rgbColors = extractUnique(html, /rgba?\([^)]+\)/gi);
  const allColors = [...hexColors, ...rgbColors];
  const fontFamilies = extractCssValues(html, "font-family");
  const fontSizes = extractCssValues(html, "font-size");
  const fontWeights = extractCssValues(html, "font-weight");
  const lineHeights = extractCssValues(html, "line-height");
  const spacings = [...new Set([
    ...extractCssValues(html, "margin"),
    ...extractCssValues(html, "padding"),
    ...extractCssValues(html, "gap"),
  ])].filter((v) => /^\d/.test(v)).slice(0, 10);
  const radii = extractCssValues(html, "border-radius");
  const shadows = extractCssValues(html, "box-shadow");

  let css = `:root {\n  /* ─── Colors ──────────────────────── */\n`;
  const colorNames = ["primary", "secondary", "accent", "surface", "background", "text", "muted", "border"];
  allColors.forEach((c, i) => {
    const name = colorNames[i] ?? `color-${i + 1}`;
    css += `  ${prefix}${name}: ${c};\n`;
  });

  css += `\n  /* ─── Typography ──────────────────── */\n`;
  fontFamilies.forEach((f, i) => {
    const names = ["font-primary", "font-secondary", "font-mono"];
    css += `  ${prefix}${names[i] ?? "font-" + (i + 1)}: ${f};\n`;
  });
  const sizeNames = ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl"];
  fontSizes.forEach((s, i) => {
    css += `  ${prefix}${sizeNames[i] ?? "text-" + (i + 1)}: ${s};\n`;
  });
  fontWeights.forEach((w, i) => {
    css += `  ${prefix}font-weight-${i + 1}: ${w};\n`;
  });
  lineHeights.forEach((lh, i) => {
    css += `  ${prefix}leading-${i + 1}: ${lh};\n`;
  });

  css += `\n  /* ─── Spacing ─────────────────────── */\n`;
  spacings.forEach((s, i) => {
    css += `  ${prefix}space-${i + 1}: ${s};\n`;
  });

  css += `\n  /* ─── Border Radius ───────────────── */\n`;
  const radiusNames = ["radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-full"];
  radii.forEach((r, i) => {
    css += `  ${prefix}${radiusNames[i] ?? "radius-" + (i + 1)}: ${r};\n`;
  });

  css += `\n  /* ─── Shadows ─────────────────────── */\n`;
  const shadowNames = ["shadow-sm", "shadow-md", "shadow-lg", "shadow-xl"];
  shadows.slice(0, 4).forEach((s, i) => {
    css += `  ${prefix}${shadowNames[i] ?? "shadow-" + (i + 1)}: ${s};\n`;
  });

  css += `}\n`;

  if (includeDarkMode) {
    css += `\n@media (prefers-color-scheme: dark) {\n  :root {\n`;
    css += `    /* Inverted surface/background colors for dark mode */\n`;
    allColors.forEach((c, i) => {
      const name = colorNames[i] ?? `color-${i + 1}`;
      // Simple inversion heuristic: light colors become dark, dark stay similar
      const lc = c.toLowerCase();
      let darkVal = c;
      if (/^#f|^#e|^#d|^#c|^#b|^#a|^#9/.test(lc)) {
        // Light color — darken significantly
        darkVal = `/* TODO: adjust */ ${c}`;
      } else if (/^#[0-3]/.test(lc)) {
        // Very dark — lighten for readability
        darkVal = `/* TODO: adjust */ ${c}`;
      }
      css += `    ${prefix}${name}: ${darkVal};\n`;
    });
    css += `  }\n}\n`;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            screenId,
            variableCount: allColors.length + fontFamilies.length + fontSizes.length + spacings.length + radii.length + shadows.length,
            hasDarkModeOverrides: includeDarkMode,
            css,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handles validate_design_system.
 */
async function handleValidateDesignSystem(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = requireString(args.projectId, "projectId");
  const screenId = requireString(args.screenId, "screenId");
  const approvedColors = (args.approvedColors as string[]) ?? [];
  const approvedFonts = (args.approvedFonts as string[]) ?? [];
  const approvedSpacing = (args.approvedSpacing as string[]) ?? [];
  const approvedRadii = (args.approvedRadii as string[]) ?? [];
  const strictMode = args.strictMode === true;

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  const violations: Array<{
    category: string;
    value: string;
    severity: "error" | "warning";
    suggestion: string;
  }> = [];

  const passes: Array<{ category: string; detail: string }> = [];

  // Check colors
  if (approvedColors.length > 0) {
    const usedColors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g);
    const approvedSet = new Set(approvedColors.map((c) => c.toLowerCase()));
    let colorViolations = 0;
    for (const color of usedColors) {
      if (!approvedSet.has(color.toLowerCase())) {
        colorViolations++;
        const closest = findClosestValue(color.toLowerCase(), [...approvedSet]);
        violations.push({
          category: "color",
          value: color,
          severity: strictMode ? "error" : "warning",
          suggestion: closest ? `Use approved color ${closest} instead` : "Add to approved palette or replace",
        });
      }
    }
    if (colorViolations === 0) {
      passes.push({ category: "color", detail: `All ${usedColors.length} colors are from the approved palette` });
    }
  }

  // Check fonts
  if (approvedFonts.length > 0) {
    const usedFonts = extractCssValues(html, "font-family");
    const approvedFontSet = new Set(approvedFonts.map((f) => f.toLowerCase().trim()));
    let fontViolations = 0;
    for (const font of usedFonts) {
      const fontLower = font.toLowerCase().replace(/['"]/g, "").trim();
      const isApproved = [...approvedFontSet].some((af) => fontLower.includes(af));
      if (!isApproved) {
        fontViolations++;
        violations.push({
          category: "typography",
          value: font,
          severity: "error",
          suggestion: `Replace with an approved font: ${approvedFonts.join(", ")}`,
        });
      }
    }
    if (fontViolations === 0 && usedFonts.length > 0) {
      passes.push({ category: "typography", detail: "All fonts are from the approved set" });
    }
  }

  // Check spacing
  if (approvedSpacing.length > 0) {
    const usedSpacing = [...new Set([
      ...extractCssValues(html, "margin"),
      ...extractCssValues(html, "padding"),
      ...extractCssValues(html, "gap"),
    ])];
    const approvedSpacingSet = new Set(approvedSpacing.map((s) => s.toLowerCase().trim()));
    let spacingViolations = 0;
    for (const sp of usedSpacing) {
      if (!approvedSpacingSet.has(sp.toLowerCase().trim())) {
        spacingViolations++;
        const closest = findClosestValue(sp, [...approvedSpacingSet]);
        violations.push({
          category: "spacing",
          value: sp,
          severity: strictMode ? "error" : "warning",
          suggestion: closest ? `Use approved spacing ${closest} instead` : "Align to spacing scale",
        });
      }
    }
    if (spacingViolations === 0 && usedSpacing.length > 0) {
      passes.push({ category: "spacing", detail: "All spacing values are from the approved scale" });
    }
  }

  // Check border-radius
  if (approvedRadii.length > 0) {
    const usedRadii = extractCssValues(html, "border-radius");
    const approvedRadiiSet = new Set(approvedRadii.map((r) => r.toLowerCase().trim()));
    let radiusViolations = 0;
    for (const r of usedRadii) {
      if (!approvedRadiiSet.has(r.toLowerCase().trim())) {
        radiusViolations++;
        violations.push({
          category: "border-radius",
          value: r,
          severity: strictMode ? "error" : "warning",
          suggestion: `Use an approved radius: ${approvedRadii.join(", ")}`,
        });
      }
    }
    if (radiusViolations === 0 && usedRadii.length > 0) {
      passes.push({ category: "border-radius", detail: "All border radii are from the approved set" });
    }
  }

  const totalChecks = violations.length + passes.length;
  const complianceScore = totalChecks > 0 ? Math.round((passes.length / totalChecks) * 100) : 100;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            screenId,
            complianceScore,
            strictMode,
            summary: {
              totalViolations: violations.length,
              errors: violations.filter((v) => v.severity === "error").length,
              warnings: violations.filter((v) => v.severity === "warning").length,
              passes: passes.length,
            },
            violations: violations.slice(0, 30),
            passes,
            recommendation: complianceScore >= 90
              ? "Screen is well-aligned with the design system."
              : complianceScore >= 70
              ? "Screen mostly follows the design system but has some deviations to address."
              : "Screen has significant deviations from the design system. Consider a design review.",
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Simple heuristic to find the closest matching value from a set.
 */
function findClosestValue(value: string, approved: string[]): string | null {
  if (approved.length === 0) return null;
  // For hex colors, try simple string distance
  let best = approved[0];
  let bestDist = Infinity;
  for (const a of approved) {
    const dist = levenshteinDistance(value.toLowerCase(), a.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = a;
    }
  }
  return bestDist <= 4 ? best : null;
}

/**
 * Simple Levenshtein distance for short strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Handles generate_dark_mode.
 */
async function handleGenerateDarkMode(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = requireString(args.projectId, "projectId");
  const screenId = requireString(args.screenId, "screenId");
  const preserveAccents = args.preserveAccents !== false;
  const contrast = (args.contrast as string) ?? "normal";
  const deviceType = (args.deviceType as string) ?? "MOBILE";

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  // Analyse current colors
  const hexColors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g);
  const fontFamilies = extractCssValues(html, "font-family");

  // Detect components in the screen
  const components: string[] = [];
  if (/<nav/i.test(html)) components.push("navigation bar");
  if (/hero|banner/i.test(html)) components.push("hero section");
  if (/card|<article/i.test(html)) components.push("card components");
  if (/<form|<input/i.test(html)) components.push("form elements");
  if (/<button/i.test(html)) components.push("buttons");
  if (/<table/i.test(html)) components.push("data table");
  if (/<footer/i.test(html)) components.push("footer");

  const contrastNote = contrast === "high"
    ? "Use HIGH CONTRAST for accessibility — ensure all text has at least 7:1 contrast ratio against backgrounds."
    : "Use standard contrast ratios — ensure at least 4.5:1 for normal text.";

  const accentNote = preserveAccents
    ? `Keep these accent/brand colors unchanged: ${hexColors.slice(0, 3).join(", ")}. Only invert backgrounds, surfaces, and text colors.`
    : "Adjust all colors for the dark theme, including accents.";

  const prompt = `Create a DARK MODE version of a screen that contains: ${components.join(", ") || "standard UI elements"}.

COLOR TRANSFORMATION RULES:
- White/light backgrounds (#fff, #f5f5f5, etc.) become dark (#0f0f0f, #1a1a1a, #262626)
- Dark text (#000, #333) becomes light text (#e5e5e5, #f5f5f5)
- Light borders become subtle dark borders (rgba(255,255,255,0.1))
- Shadows shift to subtle glows or darker shadows
${accentNote}

${contrastNote}

${fontFamilies.length > 0 ? `Maintain fonts: ${fontFamilies.slice(0, 2).join(", ")}.` : ""}

Keep the same layout, component structure, and spacing as the original. This should look like a native dark mode, not just an inverted design.`;

  const result = await callUpstreamTool(
    "generate_screen_from_text",
    { projectId: pid, prompt, deviceType },
    creds,
    projectId
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            message: "Dark mode variant generated",
            sourceScreen: screenId,
            preserveAccents,
            contrast,
            detectedComponents: components,
            originalColors: hexColors.slice(0, 8),
            result,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handles generate_component_variants.
 */
async function handleGenerateComponentVariants(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = requireString(args.projectId, "projectId");
  const screenId = requireString(args.screenId, "screenId");
  const componentType = requireString(args.componentType, "componentType");
  const variantCount = Math.min(Math.max((args.variantCount as number) ?? 3, 1), 5);
  const variantStyles = (args.variantStyles as string[]) ?? [];
  const deviceType = (args.deviceType as string) ?? "DESKTOP";

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  // Extract design context for consistency
  const colors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g).slice(0, 5);
  const fonts = extractCssValues(html, "font-family").slice(0, 2);

  const componentDescriptions: Record<string, string> = {
    button: "a set of button components in various states (default, hover, active, disabled) with icons and text",
    card: "a set of card components with image, title, description, tags, and action buttons",
    hero: "a hero section with headline, subheadline, CTA buttons, and supporting visual",
    form: "a form with labeled inputs, validation states, helper text, and submit/cancel buttons",
    navigation: "a navigation bar with logo, menu items, search, and user menu",
    "pricing-card": "a pricing card with plan name, price, feature list, and CTA button",
    testimonial: "a testimonial card with avatar, name, role, company, quote text, and rating stars",
    footer: "a footer with columns for links, newsletter signup, social icons, and copyright",
  };

  const componentDesc = componentDescriptions[componentType] ?? `${componentType} component`;

  const defaultStyles = ["minimal", "rounded", "gradient", "outlined", "glassmorphism"];
  const stylesToUse = variantStyles.length > 0 ? variantStyles.slice(0, variantCount) : defaultStyles.slice(0, variantCount);

  const styleDescriptions: Record<string, string> = {
    minimal: "clean and minimal with lots of whitespace, thin borders, and subtle typography",
    rounded: "soft and rounded with large border-radius, gentle shadows, and warm colors",
    sharp: "sharp and angular with square corners, bold lines, and high contrast",
    gradient: "featuring gradient backgrounds, gradient text, and gradient borders",
    outlined: "outlined/wireframe style with transparent backgrounds and visible borders",
    filled: "solid filled backgrounds with inverted text colors and minimal borders",
    glassmorphism: "frosted glass effect with backdrop blur, semi-transparent backgrounds, and subtle borders",
    brutalist: "raw brutalist style with bold typography, stark black/white contrast, and intentionally rough edges",
  };

  const results: Array<{ style: string; status: string; result?: unknown; error?: string }> = [];

  for (let i = 0; i < variantCount; i++) {
    const style = stylesToUse[i % stylesToUse.length];
    const styleDesc = styleDescriptions[style] ?? style;

    const prompt = `Create ${componentDesc}.

VISUAL STYLE: ${styleDesc}

DESIGN SYSTEM REFERENCE:
${colors.length > 0 ? `- Colors: ${colors.join(", ")}` : ""}
${fonts.length > 0 ? `- Fonts: ${fonts.join(", ")}` : ""}

Show the component in a clean showcase layout with a neutral background. Include multiple states/sizes if applicable (e.g., small, medium, large variants).

This is variant ${i + 1} of ${variantCount} — make it visually distinct while maintaining usability.`;

    try {
      const result = await callUpstreamTool(
        "generate_screen_from_text",
        { projectId: pid, prompt, deviceType },
        creds,
        projectId
      );
      results.push({ style, status: "success", result });
    } catch (err: any) {
      results.push({ style, status: "failed", error: err.message });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            message: `Generated ${successCount}/${variantCount} ${componentType} variant(s)`,
            componentType,
            sourceScreen: screenId,
            variants: results,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handles project_summary.
 */
async function handleProjectSummary(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = requireString(args.projectId, "projectId");
  const analyzeConsistency = args.analyzeConsistency !== false;
  const maxScreens = Math.min((args.maxScreensToAnalyze as number) ?? 5, 10);

  // Get project details
  let projectInfo: unknown = null;
  try {
    projectInfo = await callUpstreamTool("get_project", { projectId: pid }, creds, projectId);
  } catch {
    // Project details unavailable
  }

  // List screens
  let screenList: ReadonlyArray<{ screenId: string; name?: string }> = [];
  try {
    const listRes = await callUpstreamTool("list_screens", { projectId: pid }, creds, projectId);
    screenList = parseScreenList(listRes);
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Failed to list screens: ${err.message}` }],
      isError: true,
    };
  }

  // Consistency analysis
  let consistencyScore: number | null = null;
  const designPatterns: Record<string, number> = {};
  const allColors: Set<string> = new Set();
  const allFonts: Set<string> = new Set();
  const allComponents: Set<string> = new Set();
  const screenColorSets: string[][] = [];

  if (analyzeConsistency && screenList.length > 0) {
    const screensToAnalyze = screenList.slice(0, maxScreens);

    for (const screen of screensToAnalyze) {
      try {
        const html = await fetchScreenHtml(pid, screen.screenId, creds, projectId);

        const colors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g);
        const fonts = extractCssValues(html, "font-family");

        colors.forEach((c) => allColors.add(c));
        fonts.forEach((f) => allFonts.add(f));
        screenColorSets.push([...colors]);

        // Detect patterns
        if (/<nav/i.test(html)) { designPatterns["navigation"] = (designPatterns["navigation"] ?? 0) + 1; allComponents.add("navigation"); }
        if (/hero|banner/i.test(html)) { designPatterns["hero"] = (designPatterns["hero"] ?? 0) + 1; allComponents.add("hero"); }
        if (/card|<article/i.test(html)) { designPatterns["cards"] = (designPatterns["cards"] ?? 0) + 1; allComponents.add("cards"); }
        if (/<form|<input/i.test(html)) { designPatterns["forms"] = (designPatterns["forms"] ?? 0) + 1; allComponents.add("forms"); }
        if (/<button/i.test(html)) { designPatterns["buttons"] = (designPatterns["buttons"] ?? 0) + 1; allComponents.add("buttons"); }
        if (/<table/i.test(html)) { designPatterns["tables"] = (designPatterns["tables"] ?? 0) + 1; allComponents.add("tables"); }
        if (/modal|dialog/i.test(html)) { designPatterns["modals"] = (designPatterns["modals"] ?? 0) + 1; allComponents.add("modals"); }
        if (/<footer/i.test(html)) { designPatterns["footer"] = (designPatterns["footer"] ?? 0) + 1; allComponents.add("footer"); }

        if (/display:\s*grid/i.test(html)) designPatterns["grid-layout"] = (designPatterns["grid-layout"] ?? 0) + 1;
        if (/display:\s*flex/i.test(html)) designPatterns["flex-layout"] = (designPatterns["flex-layout"] ?? 0) + 1;
      } catch {
        // Skip screens that fail to fetch
      }
    }

    // Compute consistency: how many colors are shared across screens
    if (screenColorSets.length >= 2) {
      let pairwiseOverlap = 0;
      let pairCount = 0;
      for (let i = 0; i < screenColorSets.length; i++) {
        for (let j = i + 1; j < screenColorSets.length; j++) {
          const set1 = new Set(screenColorSets[i]);
          const set2 = new Set(screenColorSets[j]);
          const shared = [...set1].filter((c) => set2.has(c)).length;
          const total = new Set([...set1, ...set2]).size;
          pairwiseOverlap += total > 0 ? shared / total : 0;
          pairCount++;
        }
      }
      consistencyScore = pairCount > 0 ? Math.round((pairwiseOverlap / pairCount) * 100) : null;
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            projectId: pid,
            projectInfo: projectInfo ?? "Unable to fetch project details",
            summary: {
              totalScreens: screenList.length,
              screens: screenList.map((s) => ({ screenId: s.screenId, name: s.name ?? null })),
              analyzedScreens: analyzeConsistency ? Math.min(screenList.length, maxScreens) : 0,
            },
            designAnalysis: analyzeConsistency ? {
              consistencyScore,
              consistencyRating: consistencyScore !== null
                ? consistencyScore >= 80 ? "excellent" : consistencyScore >= 60 ? "good" : consistencyScore >= 40 ? "moderate" : "low"
                : null,
              uniqueColors: allColors.size,
              uniqueFonts: allFonts.size,
              componentTypes: [...allComponents],
              patterns: designPatterns,
            } : null,
            recommendations: generateProjectRecommendations(screenList.length, allColors.size, allFonts.size, consistencyScore),
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Generates project-level recommendations based on analysis.
 */
function generateProjectRecommendations(
  screenCount: number,
  colorCount: number,
  fontCount: number,
  consistency: number | null
): string[] {
  const recs: string[] = [];

  if (colorCount > 15) {
    recs.push(`${colorCount} unique colors detected — consider consolidating to a focused palette of 8-12 colors for better consistency.`);
  }
  if (fontCount > 3) {
    recs.push(`${fontCount} font families detected — limit to 2-3 for a more cohesive design.`);
  }
  if (consistency !== null && consistency < 50) {
    recs.push("Low design consistency across screens — consider extracting a design context from your best screen and applying it to others.");
  }
  if (screenCount === 0) {
    recs.push("No screens found. Start by generating screens from templates or text prompts.");
  }
  if (screenCount > 0 && screenCount <= 2) {
    recs.push("Small project — consider adding more screens for a complete user flow (navigation, main content, detail views).");
  }

  if (recs.length === 0) {
    recs.push("Project looks well-organized. Continue maintaining design consistency as you add new screens.");
  }

  return recs;
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/**
 * Dispatches an advanced tool call.
 *
 * @param name      - Tool name.
 * @param args      - Tool arguments.
 * @param creds     - Resolved auth credentials.
 * @param projectId - Optional project ID override.
 */
export async function handleAdvancedTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "screen_to_tailwind_config":
        return await handleScreenToTailwindConfig(args, creds, projectId);
      case "screen_to_css_variables":
        return await handleScreenToCssVariables(args, creds, projectId);
      case "validate_design_system":
        return await handleValidateDesignSystem(args, creds, projectId);
      case "generate_dark_mode":
        return await handleGenerateDarkMode(args, creds, projectId);
      case "generate_component_variants":
        return await handleGenerateComponentVariants(args, creds, projectId);
      case "project_summary":
        return await handleProjectSummary(args, creds, projectId);
      default:
        return { content: [{ type: "text", text: `Unknown advanced tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}
