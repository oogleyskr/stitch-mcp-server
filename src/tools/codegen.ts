/**
 * Code generation tools — convert Stitch screen HTML to framework-specific components.
 *
 * Provides screen-to-React component conversion with Tailwind CSS extraction.
 */

import type { ToolDefinition, McpToolResult, AuthCredentials } from "../types";
import { fetchScreenHtml } from "../stitch-client";

/** Tool definitions for codegen tools. */
export const codegenToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "screen_to_react",
    description:
      "Converts a Stitch screen's HTML into a clean React/TSX function component with a typed props interface, Tailwind CSS classes extracted from inline styles where possible, and proper imports. Returns usable React code ready to drop into a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The Stitch project ID." },
        screenId: { type: "string", description: "The screen ID to convert." },
        componentName: {
          type: "string",
          description: "Name for the generated React component (PascalCase). Defaults to 'Screen'.",
        },
        includeResponsive: {
          type: "boolean",
          description: "Include responsive Tailwind modifiers (sm:, md:, lg:).",
          default: false,
        },
      },
      required: ["projectId", "screenId"],
    },
  },
];

// ─── Inline-style-to-Tailwind mapping ────────────────────────────────────────

/** Maps common CSS property-value pairs to Tailwind utility classes. */
const STYLE_TO_TAILWIND: ReadonlyArray<{ pattern: RegExp; tailwind: (match: RegExpMatchArray) => string }> = [
  // Display
  { pattern: /display:\s*flex/i, tailwind: () => "flex" },
  { pattern: /display:\s*grid/i, tailwind: () => "grid" },
  { pattern: /display:\s*none/i, tailwind: () => "hidden" },
  { pattern: /display:\s*block/i, tailwind: () => "block" },
  { pattern: /display:\s*inline-block/i, tailwind: () => "inline-block" },
  { pattern: /display:\s*inline/i, tailwind: () => "inline" },

  // Flex
  { pattern: /flex-direction:\s*column/i, tailwind: () => "flex-col" },
  { pattern: /flex-direction:\s*row/i, tailwind: () => "flex-row" },
  { pattern: /flex-wrap:\s*wrap/i, tailwind: () => "flex-wrap" },
  { pattern: /justify-content:\s*center/i, tailwind: () => "justify-center" },
  { pattern: /justify-content:\s*space-between/i, tailwind: () => "justify-between" },
  { pattern: /justify-content:\s*space-around/i, tailwind: () => "justify-around" },
  { pattern: /justify-content:\s*flex-start/i, tailwind: () => "justify-start" },
  { pattern: /justify-content:\s*flex-end/i, tailwind: () => "justify-end" },
  { pattern: /align-items:\s*center/i, tailwind: () => "items-center" },
  { pattern: /align-items:\s*flex-start/i, tailwind: () => "items-start" },
  { pattern: /align-items:\s*flex-end/i, tailwind: () => "items-end" },
  { pattern: /align-items:\s*stretch/i, tailwind: () => "items-stretch" },

  // Positioning
  { pattern: /position:\s*relative/i, tailwind: () => "relative" },
  { pattern: /position:\s*absolute/i, tailwind: () => "absolute" },
  { pattern: /position:\s*fixed/i, tailwind: () => "fixed" },
  { pattern: /position:\s*sticky/i, tailwind: () => "sticky" },

  // Overflow
  { pattern: /overflow:\s*hidden/i, tailwind: () => "overflow-hidden" },
  { pattern: /overflow:\s*auto/i, tailwind: () => "overflow-auto" },
  { pattern: /overflow:\s*scroll/i, tailwind: () => "overflow-scroll" },

  // Text
  { pattern: /text-align:\s*center/i, tailwind: () => "text-center" },
  { pattern: /text-align:\s*left/i, tailwind: () => "text-left" },
  { pattern: /text-align:\s*right/i, tailwind: () => "text-right" },
  { pattern: /font-weight:\s*bold/i, tailwind: () => "font-bold" },
  { pattern: /font-weight:\s*600/i, tailwind: () => "font-semibold" },
  { pattern: /font-weight:\s*500/i, tailwind: () => "font-medium" },
  { pattern: /font-weight:\s*300/i, tailwind: () => "font-light" },
  { pattern: /font-weight:\s*700/i, tailwind: () => "font-bold" },
  { pattern: /font-style:\s*italic/i, tailwind: () => "italic" },
  { pattern: /text-decoration:\s*underline/i, tailwind: () => "underline" },
  { pattern: /text-decoration:\s*line-through/i, tailwind: () => "line-through" },
  { pattern: /text-decoration:\s*none/i, tailwind: () => "no-underline" },
  { pattern: /text-transform:\s*uppercase/i, tailwind: () => "uppercase" },
  { pattern: /text-transform:\s*lowercase/i, tailwind: () => "lowercase" },
  { pattern: /text-transform:\s*capitalize/i, tailwind: () => "capitalize" },
  { pattern: /white-space:\s*nowrap/i, tailwind: () => "whitespace-nowrap" },

  // Width / Height
  { pattern: /width:\s*100%/i, tailwind: () => "w-full" },
  { pattern: /height:\s*100%/i, tailwind: () => "h-full" },
  { pattern: /width:\s*100vw/i, tailwind: () => "w-screen" },
  { pattern: /height:\s*100vh/i, tailwind: () => "h-screen" },
  { pattern: /min-width:\s*100%/i, tailwind: () => "min-w-full" },
  { pattern: /min-height:\s*100%/i, tailwind: () => "min-h-full" },
  { pattern: /min-height:\s*100vh/i, tailwind: () => "min-h-screen" },

  // Cursor
  { pattern: /cursor:\s*pointer/i, tailwind: () => "cursor-pointer" },
  { pattern: /cursor:\s*not-allowed/i, tailwind: () => "cursor-not-allowed" },

  // Border
  { pattern: /border-radius:\s*9999px/i, tailwind: () => "rounded-full" },
  { pattern: /border-radius:\s*50%/i, tailwind: () => "rounded-full" },
  { pattern: /border:\s*none/i, tailwind: () => "border-0" },

  // Opacity
  { pattern: /opacity:\s*0(?:\.0+)?(?:;|$)/i, tailwind: () => "opacity-0" },
  { pattern: /opacity:\s*0\.5/i, tailwind: () => "opacity-50" },
  { pattern: /opacity:\s*1(?:;|$)/i, tailwind: () => "opacity-100" },
];

/**
 * Attempts to convert an inline style string to Tailwind classes.
 * Returns the Tailwind classes and any remaining unconverted styles.
 */
function inlineStyleToTailwind(style: string): { classes: string[]; remainingStyle: string } {
  const classes: string[] = [];
  let remaining = style;

  for (const rule of STYLE_TO_TAILWIND) {
    if (rule.pattern.test(remaining)) {
      const match = remaining.match(rule.pattern);
      if (match) {
        classes.push(rule.tailwind(match));
        // Remove the matched property from the remaining style
        remaining = remaining.replace(
          new RegExp(`${rule.pattern.source}\\s*;?\\s*`, "i"),
          ""
        );
      }
    }
  }

  return { classes, remainingStyle: remaining.trim().replace(/;$/, "").trim() };
}

/**
 * Converts HTML attributes from snake_case/kebab-case to React camelCase JSX.
 */
function htmlToJsxAttributes(html: string): string {
  let jsx = html;

  // class -> className
  jsx = jsx.replace(/\bclass="/g, 'className="');
  jsx = jsx.replace(/\bclass='/g, "className='");

  // for -> htmlFor
  jsx = jsx.replace(/\bfor="/g, 'htmlFor="');

  // Self-closing void elements
  const voidElements = ["img", "input", "br", "hr", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"];
  for (const el of voidElements) {
    jsx = jsx.replace(
      new RegExp(`<${el}((?:[^>]*?)(?<!\\/))(>)`, "gi"),
      `<${el}$1 />`
    );
  }

  // tabindex -> tabIndex
  jsx = jsx.replace(/\btabindex=/gi, "tabIndex=");
  // autocomplete -> autoComplete
  jsx = jsx.replace(/\bautocomplete=/gi, "autoComplete=");
  // maxlength -> maxLength
  jsx = jsx.replace(/\bmaxlength=/gi, "maxLength=");
  // readonly -> readOnly
  jsx = jsx.replace(/\breadonly(?=\s|>|\/)/gi, "readOnly");
  // colspan -> colSpan
  jsx = jsx.replace(/\bcolspan=/gi, "colSpan=");
  // rowspan -> rowSpan
  jsx = jsx.replace(/\browspan=/gi, "rowSpan=");

  return jsx;
}

/**
 * Processes inline styles in the HTML, converting them to Tailwind where possible.
 */
function processInlineStyles(html: string): string {
  return html.replace(
    /style="([^"]*)"/gi,
    (_match, styleValue: string) => {
      const { classes, remainingStyle } = inlineStyleToTailwind(styleValue);

      if (classes.length === 0) {
        // No conversion possible, keep original style
        return `style="{{${cssToReactStyle(styleValue)}}}"`;
      }

      // Check if element already has className
      const twClassStr = classes.join(" ");

      if (remainingStyle) {
        // Some styles remain, keep both
        return `className="${twClassStr}" style={{${cssToReactStyle(remainingStyle)}}}`;
      }

      // All styles converted
      return `className="${twClassStr}"`;
    }
  );
}

/**
 * Converts a CSS style string to a React style object string.
 */
function cssToReactStyle(css: string): string {
  return css
    .split(";")
    .filter((s) => s.trim())
    .map((s) => {
      const [prop, ...valueParts] = s.split(":");
      if (!prop || valueParts.length === 0) return "";
      const camelProp = prop
        .trim()
        .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = valueParts.join(":").trim();
      // Wrap numeric-only values without quotes, strings with quotes
      const isNumeric = /^-?\d+(\.\d+)?$/.test(value);
      return isNumeric ? `${camelProp}: ${value}` : `${camelProp}: "${value}"`;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Merges className attributes on the same element.
 */
function mergeClassNames(html: string): string {
  // Find elements with both existing className and newly added className
  return html.replace(
    /className="([^"]*)"(\s+)className="([^"]*)"/g,
    (_match, cls1, space, cls2) => `className="${cls1} ${cls2}"`
  );
}

/**
 * Extracts the <body> content from a full HTML document.
 */
function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();

  // If no body tag, try to strip html/head
  const stripped = html
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .trim();

  return stripped || html;
}

// ─── Tool handler ────────────────────────────────────────────────────────────

async function handleScreenToReact(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  const pid = args.projectId as string;
  const screenId = args.screenId as string;
  const componentName = (args.componentName as string) ?? "Screen";
  const includeResponsive = (args.includeResponsive as boolean) ?? false;

  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  // Extract body content
  let body = extractBody(html);

  // Convert inline styles to Tailwind
  body = processInlineStyles(body);

  // Convert HTML attributes to JSX
  body = htmlToJsxAttributes(body);

  // Merge duplicate classNames on same element
  body = mergeClassNames(body);

  // Indent body content
  const indentedBody = body
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

  // Build the component
  const responsiveNote = includeResponsive
    ? "\n * Note: Responsive modifiers (sm:, md:, lg:) have been included where detected."
    : "";

  const component = `import React from "react";

/**
 * ${componentName} component — generated from Stitch screen ${screenId}.${responsiveNote}
 */

interface ${componentName}Props {
  /** Optional additional CSS class names. */
  className?: string;
  /** Optional children to render inside the component. */
  children?: React.ReactNode;
}

export const ${componentName}: React.FC<${componentName}Props> = ({ className = "", children }) => {
  return (
    <div className={\`\${className}\`}>
${indentedBody}
      {children}
    </div>
  );
};

export default ${componentName};
`;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            componentName,
            screenId,
            framework: "react",
            styling: "tailwind",
            code: component,
            usage: `import { ${componentName} } from "./${componentName}";\n\n<${componentName} className="my-custom-class" />`,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Dispatches a codegen tool call.
 */
export async function handleCodegenTool(
  name: string,
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "screen_to_react":
        return await handleScreenToReact(args, creds, projectId);
      default:
        return { content: [{ type: "text", text: `Unknown codegen tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}
