/**
 * Design tools — extract design context, apply it to new screens,
 * generate design tokens, create responsive variants, and batch generate screens.
 *
 * Ported from GreenSheep01201/stitch-mcp-auto design workflow tools.
 */

import type { ToolDefinition, McpToolResult, AuthCredentials, DesignContext } from "../types";
import { callUpstreamTool, fetchScreenHtml } from "../stitch-client";

/** Tool definitions for design tools. */
export const designToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "extract_design_context",
    description:
      "Extracts design DNA from an existing screen — colors, typography, spacing, layout patterns, and component styles. Use this to maintain visual consistency across multiple screens.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenId: { type: "string", description: "The screen ID to extract from." },
        includeComponents: { type: "boolean", description: "Include component-level analysis.", default: true },
        includeTypography: { type: "boolean", description: "Include typography analysis.", default: true },
        includeColors: { type: "boolean", description: "Include color palette extraction.", default: true },
        includeSpacing: { type: "boolean", description: "Include spacing/layout analysis.", default: true },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "apply_design_context",
    description:
      "Generates a new screen using a previously extracted design context for visual consistency.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        designContext: { type: "object", description: "The design context from extract_design_context." },
        prompt: { type: "string", description: "Description of the new screen to generate." },
        deviceType: { type: "string", enum: ["MOBILE", "DESKTOP", "TABLET"], description: "Target device type.", default: "MOBILE" },
      },
      required: ["projectId", "designContext", "prompt"],
    },
  },
  {
    name: "generate_design_tokens",
    description:
      "Generates design tokens (CSS variables, Tailwind config, SCSS, or JSON) from a screen's design.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenId: { type: "string", description: "The screen ID." },
        format: { type: "string", enum: ["css-variables", "tailwind", "json", "scss"], description: "Output format.", default: "css-variables" },
        includeSemanticNames: { type: "boolean", description: "Use semantic names.", default: true },
      },
      required: ["projectId", "screenId"],
    },
  },
  {
    name: "generate_responsive_variant",
    description:
      "Creates a responsive variant of an existing screen for a different device type while maintaining the same design language.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screenId: { type: "string", description: "The source screen ID." },
        targetDevice: { type: "string", enum: ["MOBILE", "DESKTOP", "TABLET"], description: "Target device type." },
        adaptationStrategy: {
          type: "string",
          enum: ["reflow", "reorganize", "simplify"],
          description: "Adaptation approach: reflow (same content, different layout), reorganize (restructure for device), simplify (remove non-essential elements).",
          default: "reflow",
        },
      },
      required: ["projectId", "screenId", "targetDevice"],
    },
  },
  {
    name: "batch_generate_screens",
    description:
      "Generates multiple related screens in a single operation with consistent design language.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        screens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Screen name identifier." },
              prompt: { type: "string", description: "Description for this screen." },
            },
            required: ["name", "prompt"],
          },
          description: "Array of screens to generate.",
        },
        sharedDesignContext: { type: "object", description: "Optional shared design context for all screens." },
        deviceType: { type: "string", enum: ["MOBILE", "DESKTOP", "TABLET"], description: "Device type for all screens.", default: "MOBILE" },
      },
      required: ["projectId", "screens"],
    },
  },
  {
    name: "generate_from_template",
    description:
      "Generates a screen from a predefined UI template with user customizations. Provides 10 common templates (dashboard, settings, login, profile, pricing, landing-hero, data-table, kanban-board, chat-interface, file-manager) as a base prompt, layered with custom instructions for faster UI generation.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The project ID." },
        template: {
          type: "string",
          enum: ["dashboard", "settings", "login", "profile", "pricing", "landing-hero", "data-table", "kanban-board", "chat-interface", "file-manager"],
          description: "The base template to use.",
        },
        customization: {
          type: "string",
          description: "Custom instructions to layer on top of the template (e.g., 'use dark theme with purple accents, add a sidebar with user avatar').",
        },
        deviceType: { type: "string", enum: ["MOBILE", "DESKTOP", "TABLET"], description: "Target device type.", default: "DESKTOP" },
        style: {
          type: "string",
          enum: ["modern", "minimal", "corporate", "playful", "elegant"],
          description: "Overall visual style.",
          default: "modern",
        },
      },
      required: ["projectId", "template"],
    },
  },
];

// ─── HTML analysis helpers ───────────────────────────────────────────────────

/** Extracts unique regex matches from HTML content. */
function extractUnique(html: string, pattern: RegExp): string[] {
  return [...new Set(html.match(pattern) ?? [])];
}

/** Extracts CSS property values from HTML. */
function extractCssValues(html: string, property: string): string[] {
  const regex = new RegExp(`${property}:\\s*([^;]+)`, "gi");
  const matches = html.match(regex) ?? [];
  return [...new Set(matches.map((m) => m.split(":")[1]?.trim()).filter(Boolean))];
}

/**
 * Extracts a full design context from HTML content.
 */
function extractDesignContextFromHtml(
  html: string,
  projectId: string,
  screenId: string,
  opts: Record<string, unknown>
): DesignContext {
  const colors: { primary: string[]; secondary: string[]; neutral: string[]; accent: string[] } = {
    primary: [],
    secondary: [],
    neutral: [],
    accent: [],
  };

  if (opts.includeColors !== false) {
    const hexColors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g);
    const rgbColors = extractUnique(html, /rgba?\([^)]+\)/gi);
    const hslColors = extractUnique(html, /hsla?\([^)]+\)/gi);
    const allColors = [...new Set([...hexColors, ...rgbColors, ...hslColors])];

    for (const color of allColors) {
      const lc = color.toLowerCase();
      if (/fff|f5f5|e5e5|000|111|222|333/.test(lc)) {
        colors.neutral.push(color);
      } else if (colors.primary.length < 3) {
        colors.primary.push(color);
      } else if (colors.secondary.length < 3) {
        colors.secondary.push(color);
      } else {
        colors.accent.push(color);
      }
    }
  }

  const typography = {
    fontFamilies: opts.includeTypography !== false ? extractCssValues(html, "font-family") : [],
    fontSizes: opts.includeTypography !== false ? extractCssValues(html, "font-size") : [],
    fontWeights: opts.includeTypography !== false ? extractCssValues(html, "font-weight") : [],
    lineHeights: opts.includeTypography !== false ? extractCssValues(html, "line-height") : [],
  };

  const spacing = {
    margins: opts.includeSpacing !== false ? extractCssValues(html, "margin[^:]*").slice(0, 10) : [],
    paddings: opts.includeSpacing !== false ? extractCssValues(html, "padding[^:]*").slice(0, 10) : [],
    gaps: opts.includeSpacing !== false ? extractCssValues(html, "gap") : [],
  };

  const borderRadius = extractCssValues(html, "border-radius");
  const shadows = extractCssValues(html, "box-shadow").slice(0, 5);

  const components: string[] = [];
  const layoutPatterns: string[] = [];
  if (opts.includeComponents !== false) {
    if (/<button|btn/i.test(html)) components.push("button");
    if (/<input|<form/i.test(html)) components.push("form");
    if (/<nav|navbar/i.test(html)) components.push("navigation");
    if (/card|<article/i.test(html)) components.push("card");
    if (/modal|dialog/i.test(html)) components.push("modal");
    if (/<img|hero/i.test(html)) components.push("hero");
    if (/grid|flex/i.test(html)) layoutPatterns.push("grid-system");
  }

  return {
    extractedFrom: { projectId, screenId },
    extractedAt: new Date().toISOString(),
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    components,
    layoutPatterns,
  };
}

// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleExtractDesignContext(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const html = await fetchScreenHtml(pid, screenId, creds, projectId);
  const designContext = extractDesignContextFromHtml(html, pid, screenId, args);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            designContext,
            usage: "Use this design context with 'apply_design_context' to generate new screens with consistent styling.",
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleApplyDesignContext(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const dc = args.designContext as any;
  const prompt = args.prompt as string;
  const deviceType = (args.deviceType as string) ?? "MOBILE";

  const styleLines: string[] = [];
  if (dc?.colors?.primary?.length > 0) {
    styleLines.push(`Primary colors: ${dc.colors.primary.slice(0, 3).join(", ")}`);
  }
  if (dc?.colors?.secondary?.length > 0) {
    styleLines.push(`Secondary colors: ${dc.colors.secondary.slice(0, 3).join(", ")}`);
  }
  if (dc?.typography?.fontFamilies?.length > 0) {
    styleLines.push(`Fonts: ${dc.typography.fontFamilies.slice(0, 2).join(", ")}`);
  }
  if (dc?.borderRadius?.length > 0) {
    styleLines.push(`Border radius: ${dc.borderRadius[0]}`);
  }
  if (dc?.shadows?.length > 0) {
    styleLines.push(`Shadow style: ${dc.shadows[0]}`);
  }

  const enhancedPrompt = `${prompt}\n\nIMPORTANT: Apply the following design system for visual consistency:\n${styleLines.join("\n")}\n\nMaintain the same visual language, spacing rhythm, and component styles as the reference design.`;

  const result = await callUpstreamTool(
    "generate_screen_from_text",
    { projectId: args.projectId as string, prompt: enhancedPrompt, deviceType },
    creds,
    projectId
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ success: true, message: "Screen generated with applied design context", appliedStyles: styleLines, result }, null, 2),
      },
    ],
  };
}

async function handleGenerateDesignTokens(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const format = (args.format as string) ?? "css-variables";
  const semantic = args.includeSemanticNames !== false;

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);
  const colors = extractUnique(html, /#[0-9A-Fa-f]{3,8}\b/g).slice(0, 10);
  const fontSizes = extractCssValues(html, "font-size").slice(0, 6);
  const spacings = extractCssValues(html, "(margin|padding|gap)").slice(0, 8);
  const radii = extractCssValues(html, "border-radius").slice(0, 4);

  let output = "";
  const sizeNames = ["xs", "sm", "base", "lg", "xl", "2xl"];
  const radiusNames = ["sm", "md", "lg", "full"];

  if (format === "css-variables") {
    output = `:root {\n  /* Colors */\n`;
    colors.forEach((c, i) => {
      const name = semantic ? `--color-${i < 2 ? "primary" : i < 4 ? "secondary" : "neutral"}-${(i % 3) + 1}` : `--color-${i + 1}`;
      output += `  ${name}: ${c};\n`;
    });
    output += `\n  /* Font Sizes */\n`;
    fontSizes.forEach((s, i) => {
      const name = semantic ? `--font-size-${sizeNames[i] ?? i}` : `--font-size-${i + 1}`;
      output += `  ${name}: ${s};\n`;
    });
    output += `\n  /* Spacing */\n`;
    spacings.forEach((s, i) => { output += `  --spacing-${i + 1}: ${s};\n`; });
    output += `\n  /* Border Radius */\n`;
    radii.forEach((r, i) => {
      const name = semantic ? `--radius-${radiusNames[i] ?? i}` : `--radius-${i + 1}`;
      output += `  ${name}: ${r};\n`;
    });
    output += `}\n`;
  } else if (format === "tailwind") {
    output = `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n`;
    colors.forEach((c, i) => {
      const name = semantic ? `${i < 2 ? "primary" : i < 4 ? "secondary" : "neutral"}${(i % 3) + 1}00` : `custom${i + 1}`;
      output += `        '${name}': '${c}',\n`;
    });
    output += `      },\n      spacing: {\n`;
    spacings.forEach((s, i) => { output += `        '${i + 1}': '${s}',\n`; });
    output += `      },\n      borderRadius: {\n`;
    radii.forEach((r, i) => { output += `        '${radiusNames[i] ?? i}': '${r}',\n`; });
    output += `      }\n    }\n  }\n};\n`;
  } else if (format === "scss") {
    output = `// Design Tokens\n\n// Colors\n`;
    colors.forEach((c, i) => {
      const name = semantic ? `$color-${i < 2 ? "primary" : i < 4 ? "secondary" : "neutral"}-${(i % 3) + 1}` : `$color-${i + 1}`;
      output += `${name}: ${c};\n`;
    });
    output += `\n// Font Sizes\n`;
    fontSizes.forEach((s, i) => { output += `$font-size-${i + 1}: ${s};\n`; });
    output += `\n// Spacing\n`;
    spacings.forEach((s, i) => { output += `$spacing-${i + 1}: ${s};\n`; });
    output += `\n// Border Radius\n`;
    radii.forEach((r, i) => { output += `$radius-${i + 1}: ${r};\n`; });
  } else {
    output = JSON.stringify({ colors, fontSizes, spacing: spacings, borderRadius: radii }, null, 2);
  }

  return { content: [{ type: "text", text: `Design Tokens (${format}):\n\n${output}` }] };
}

async function handleGenerateResponsiveVariant(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const targetDevice = args.targetDevice as string;
  const strategy = (args.adaptationStrategy as string) ?? "reflow";

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  const hasNav = /<nav|navbar/i.test(html);
  const hasHero = /hero|banner/i.test(html);
  const hasCards = /card/i.test(html);
  const hasForms = /<form|<input/i.test(html);
  const hasFooter = /<footer/i.test(html);

  const components: string[] = [];
  if (hasNav) components.push("navigation bar");
  if (hasHero) components.push("hero section");
  if (hasCards) components.push("card components");
  if (hasForms) components.push("form elements");
  if (hasFooter) components.push("footer");

  const strategyMap: Record<string, string> = {
    reflow: "Maintain all content but reflow the layout appropriately for the target device.",
    reorganize: "Reorganize content structure to optimize for the target device's interaction patterns.",
    simplify: "Simplify the design by prioritizing essential content and removing secondary elements.",
  };

  const prompt = `Create a ${targetDevice.toLowerCase()} version of a screen that contains: ${components.join(", ") || "standard UI elements"}.

${strategyMap[strategy] ?? strategyMap.reflow}

Maintain the same visual design language (colors, typography, component styles) but adapt the layout for ${targetDevice.toLowerCase()} screen dimensions.`;

  const result = await callUpstreamTool(
    "generate_screen_from_text",
    { projectId: pid, prompt, deviceType: targetDevice },
    creds,
    projectId
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { success: true, message: `Responsive ${targetDevice} variant generated`, sourceScreen: screenId, adaptationStrategy: strategy, detectedComponents: components, result },
          null,
          2
        ),
      },
    ],
  };
}

async function handleBatchGenerateScreens(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screens = args.screens as Array<{ name: string; prompt: string }>;
  const sharedContext = args.sharedDesignContext as any;
  const deviceType = (args.deviceType as string) ?? "MOBILE";

  let stylePrefix = "";
  if (sharedContext) {
    const styles: string[] = [];
    if (sharedContext.colors?.primary?.length > 0) {
      styles.push(`Primary colors: ${sharedContext.colors.primary.slice(0, 2).join(", ")}`);
    }
    if (sharedContext.typography?.fontFamilies?.length > 0) {
      styles.push(`Font: ${sharedContext.typography.fontFamilies[0]}`);
    }
    if (styles.length > 0) {
      stylePrefix = `Apply this design system: ${styles.join(". ")}. `;
    }
  }

  const results: Array<{ name: string; status: string; result?: unknown; error?: string }> = [];

  for (const screen of screens) {
    try {
      const result = await callUpstreamTool(
        "generate_screen_from_text",
        { projectId: pid, prompt: stylePrefix + screen.prompt, deviceType },
        creds,
        projectId
      );
      results.push({ name: screen.name, status: "success", result });
    } catch (err: any) {
      results.push({ name: screen.name, status: "failed", error: err.message });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { success: true, message: `Batch generation complete: ${successCount}/${screens.length} screens created`, deviceType, results },
          null,
          2
        ),
      },
    ],
  };
}


/** Template prompt library for common UI patterns. */
const TEMPLATE_PROMPTS: Record<string, string> = {
  dashboard: "Create a comprehensive dashboard screen with: a top navigation bar with search and user avatar, a sidebar with navigation links (Overview, Analytics, Reports, Settings), a main content area with summary stat cards (4 cards showing key metrics with icons and trend indicators), a line chart showing activity over time, a recent activity list, and a quick actions panel. Use a clean grid layout with proper spacing.",

  settings: "Create a settings page with: a left sidebar showing settings categories (Account, Notifications, Privacy, Appearance, Security, Integrations), a main panel showing the active category's options. Include toggle switches, dropdown selectors, text inputs with labels, a profile photo upload area, and save/cancel buttons at the bottom. Use clear section headings and helper text for each option.",

  login: "Create a login/authentication screen with: a centered card containing the app logo, a welcome message, email and password input fields with icons, a 'Remember me' checkbox, a primary 'Sign In' button, 'Forgot password?' link, social login buttons (Google, GitHub, Apple), and a 'Don't have an account? Sign up' link at the bottom. Include subtle background decoration.",

  profile: "Create a user profile page with: a hero/cover image area, a profile photo (circular, overlapping the cover), user name and bio, stats row (followers, following, posts), tab navigation (Posts, About, Photos, Connections), a content area showing the active tab. Include edit profile button, social links, and location/join date metadata.",

  pricing: "Create a pricing page with: a headline and subheadline explaining the product, a toggle for monthly/annual billing, 3 pricing tier cards (Starter, Pro, Enterprise) with: tier name, price, feature list with checkmarks, a CTA button (highlighted for the recommended tier), and a 'most popular' badge on the middle card. Include FAQ section below and a comparison table link.",

  "landing-hero": "Create a landing page hero section with: a bold headline with gradient or colored emphasis text, a supporting subheadline paragraph, two CTA buttons (primary 'Get Started' and secondary 'Watch Demo'), a hero image or illustration on the right side, floating social proof badges (customer count, rating), trusted-by logos row at the bottom, and a navigation bar at the top with logo and menu items.",

  "data-table": "Create a data table interface with: a header with title and description, search bar and filter dropdowns, action buttons (Add New, Export, Bulk Actions), a sortable table with columns (checkbox, ID, name, status badge, date, category, actions dropdown), pagination controls at the bottom (showing items per page selector, page numbers, total count), and row hover highlighting. Include empty state and loading skeleton considerations.",

  "kanban-board": "Create a kanban/project board with: a top bar with board title, view toggle (Board/List/Timeline), and filter options, multiple columns (To Do, In Progress, In Review, Done) each with a card count and add-card button, draggable task cards showing: title, priority label (color-coded), assignee avatars, due date, tag chips, and a comment count. Include a column for adding new columns.",

  "chat-interface": "Create a messaging/chat interface with: a left sidebar showing conversation list with avatars, names, last message preview, timestamp, and unread badge, a main chat area with: contact header (avatar, name, status indicator, call/video buttons), message bubbles (sent and received with different alignment and colors), timestamps between message groups, a message input area with attach file, emoji picker, and send button. Include typing indicator and read receipts.",

  "file-manager": "Create a file manager interface with: a left sidebar with folder tree navigation (Documents, Images, Videos, Shared, Trash), a toolbar with view toggle (grid/list), sort options, upload button, and search, a main area showing files in a grid with: file type icon/thumbnail, file name, size, modified date, and a context menu. Include breadcrumb navigation, drag-and-drop zone indicator, and storage usage bar at the bottom of the sidebar.",
};

/** Style modifier prompts. */
const STYLE_MODIFIERS: Record<string, string> = {
  modern: "Use a modern design with clean lines, subtle shadows, rounded corners, and a professional color palette.",
  minimal: "Use a minimalist design with maximum whitespace, thin borders, muted colors, and focus on typography.",
  corporate: "Use a corporate/enterprise design with structured layouts, formal typography, blue/gray palette, and data-dense UI.",
  playful: "Use a playful design with rounded shapes, vibrant colors, fun illustrations, and friendly typography.",
  elegant: "Use an elegant design with serif accents, refined spacing, luxury color palette (dark backgrounds with gold/cream accents), and sophisticated details.",
};

async function handleGenerateFromTemplate(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const template = args.template as string;
  const customization = args.customization as string | undefined;
  const deviceType = (args.deviceType as string) ?? "DESKTOP";
  const style = (args.style as string) ?? "modern";

  const basePrompt = TEMPLATE_PROMPTS[template];
  if (!basePrompt) {
    return {
      content: [{ type: "text", text: `Unknown template: ${template}. Available: ${Object.keys(TEMPLATE_PROMPTS).join(", ")}` }],
      isError: true,
    };
  }

  const styleModifier = STYLE_MODIFIERS[style] ?? STYLE_MODIFIERS.modern;

  let fullPrompt = basePrompt;
  fullPrompt += "\n\n" + styleModifier;

  if (customization) {
    fullPrompt += "\n\nADDITIONAL CUSTOMIZATIONS:\n" + customization;
  }

  const result = await callUpstreamTool(
    "generate_screen_from_text",
    { projectId: pid, prompt: fullPrompt, deviceType },
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
            message: `Screen generated from '${template}' template`,
            template,
            style,
            deviceType,
            customization: customization ?? null,
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
 * Dispatches a design tool call.
 */
export async function handleDesignTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "extract_design_context":
        return await handleExtractDesignContext(args, creds, projectId);
      case "apply_design_context":
        return await handleApplyDesignContext(args, creds, projectId);
      case "generate_design_tokens":
        return await handleGenerateDesignTokens(args, creds, projectId);
      case "generate_responsive_variant":
        return await handleGenerateResponsiveVariant(args, creds, projectId);
      case "batch_generate_screens":
        return await handleBatchGenerateScreens(args, creds, projectId);
      case "generate_from_template":
        return await handleGenerateFromTemplate(args, creds, projectId);
      default:
        return { content: [{ type: "text", text: `Unknown design tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}
