<div align="center">

# Stitch MCP Server

**The most comprehensive MCP server for [Google Stitch](https://stitch.googleapis.com) — 36 tools for design-to-code workflows.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Tools: 36](https://img.shields.io/badge/Tools-36-purple.svg)](#complete-tool-reference)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.0-orange.svg)](https://modelcontextprotocol.io/)

</div>

---

A modular TypeScript MCP (Model Context Protocol) server that wraps Google Stitch's design-generation API with 36 tools across 9 categories — from upstream proxy and code generation to design analysis, export, and project management.

Built by combining the best of [davideast/stitch-mcp](https://github.com/davideast/stitch-mcp) and [GreenSheep01201/stitch-mcp-auto](https://github.com/GreenSheep01201/stitch-mcp-auto), then extended with advanced design-to-code utilities.

## Features

### Core
- **Full upstream proxy** — Access all Google Stitch MCP tools directly
- **Workspace management** — Persist project associations per directory via `.stitch-project.json`
- **Auto project resolution** — Tools automatically detect the active project from session, workspace, or argument

### Design Intelligence
- **Design context extraction** — Pull colors, typography, spacing, and component patterns from any screen
- **Design system validation** — Check screens against approved tokens for compliance scoring
- **Dark mode generation** — Automatically generate dark variants with configurable contrast
- **Responsive variants** — Adapt screens across mobile, tablet, and desktop with layout strategies
- **Component variants** — Generate multiple visual styles of a component for A/B testing

### Code Generation
- **Screen to React** — Convert Stitch HTML to TSX with typed props and Tailwind classes
- **Screen to Tailwind config** — Extract a complete `tailwind.config.ts` from a design
- **Screen to CSS variables** — Generate semantic `:root` custom properties with optional dark-mode block
- **Design tokens** — Export as CSS variables, Tailwind config, SCSS, or JSON

### Analysis & Export
- **Accessibility audit** — WCAG 2.1 compliance checking with severity scoring
- **Design comparison** — Side-by-side diff of two screens (colors, typography, layout, components)
- **Design diff** — Structured element/style/text/class diff for tracking iterations
- **Bulk export** — Export all screens (HTML + screenshots) from a project
- **Style guide generation** — Visual or markdown design documentation from a screen
- **Project summary** — High-level overview with consistency scoring and recommendations

### Integration
- **PM issue generation** — Create structured issue data for Plane, Linear, Jira from screen designs
- **Template library** — 10 predefined UI templates (dashboard, login, kanban, chat, etc.)
- **Trending designs** — Apply modern design trends (glassmorphism, bento-grid, aurora gradients, etc.)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/oogleyskr/stitch-mcp-server.git
cd stitch-mcp-server
npm install

# 2. Build
npm run build

# 3. Set authentication (pick one)
export STITCH_API_KEY="your-api-key"
# OR
export STITCH_ACCESS_TOKEN="your-access-token"
# OR have gcloud CLI configured
```

## Authentication

Three methods are supported, checked in priority order:

| Priority | Method | Environment Variable | HTTP Header |
|:--------:|--------|---------------------|-------------|
| 1 | **API Key** | `STITCH_API_KEY` | `X-Goog-Api-Key: <key>` |
| 2 | **Access Token** | `STITCH_ACCESS_TOKEN` | `Authorization: Bearer <token>` |
| 3 | **gcloud CLI** | *(auto-detected)* | `Authorization: Bearer <token>` |

### Method 1: API Key (Recommended)

```bash
export STITCH_API_KEY="AIza..."
```

### Method 2: Access Token

```bash
export STITCH_ACCESS_TOKEN="ya29...."
export GOOGLE_CLOUD_PROJECT="my-project-id"  # optional, for billing
```

### Method 3: gcloud CLI

```bash
gcloud auth login
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="my-project-id"  # optional
```

The server automatically runs `gcloud auth print-access-token` and validates the token format.

## Complete Tool Reference

### Upstream Stitch Tools (7)

Tools proxied directly to Google's Stitch MCP endpoint.

| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `list_projects` | List all accessible Stitch projects | — |
| `get_project` | Get project details | `projectId` |
| `list_screens` | List screens in a project | `projectId` |
| `get_screen` | Get screen details with download URLs | `projectId`, `screenId` |
| `generate_screen_from_text` | Generate a screen from a text prompt | `projectId`, `prompt` |
| `edit_screens` | Edit existing screens with text instructions | `projectId`, `screenIds[]`, `prompt` |
| `generate_variants` | Generate design variants of a screen | `projectId`, `screenId` |

### Code & Build Tools (4)

| Tool | Description | Required Parameters | Optional |
|------|-------------|-------------------|----------|
| `get_screen_code` | Fetch raw HTML code of a screen | `projectId`, `screenId` | — |
| `get_screen_image` | Fetch screenshot as base64 PNG | `projectId`, `screenId` | — |
| `build_site` | Map screens to routes, fetch all HTML | `projectId`, `routes[]` | — |
| `list_tools` | List all available tools with schemas | — | — |

### Workspace Tools (3)

| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `get_workspace_project` | Check if workspace has a linked project | — |
| `set_workspace_project` | Link a project to current workspace | `projectId` |
| `clear_workspace_project` | Remove workspace project link | — |

### Design Tools (6)

| Tool | Description | Required Parameters | Optional |
|------|-------------|-------------------|----------|
| `extract_design_context` | Extract colors, typography, spacing, components | `projectId`, `screenId` | `includeComponents`, `includeTypography`, `includeColors`, `includeSpacing` |
| `apply_design_context` | Generate screen using extracted design context | `projectId`, `designContext`, `prompt` | `deviceType` |
| `generate_design_tokens` | Generate CSS vars / Tailwind / SCSS / JSON tokens | `projectId`, `screenId` | `format`, `includeSemanticNames` |
| `generate_responsive_variant` | Create responsive version for different viewport | `projectId`, `screenId`, `targetDevice` | `adaptationStrategy` |
| `batch_generate_screens` | Generate multiple related screens consistently | `projectId`, `screens[]` | `sharedDesignContext`, `deviceType` |
| `generate_from_template` | Generate from 10 predefined UI templates | `projectId`, `template` | `customization`, `deviceType`, `style` |

**Available templates:** `dashboard`, `settings`, `login`, `profile`, `pricing`, `landing-hero`, `data-table`, `kanban-board`, `chat-interface`, `file-manager`

**Available styles:** `modern`, `minimal`, `corporate`, `playful`, `elegant`

### Analysis Tools (4)

| Tool | Description | Required Parameters | Optional |
|------|-------------|-------------------|----------|
| `analyze_accessibility` | WCAG 2.1 accessibility analysis | `projectId`, `screenId` | `level` (A/AA/AAA), `includeRecommendations` |
| `compare_designs` | Compare two screens for design inconsistencies | `projectId`, `screenId1`, `screenId2` | `compareAspects[]` |
| `extract_components` | Extract reusable UI components | `projectId`, `screenId` | `componentTypes[]`, `outputFormat` (json/react/html/vue) |
| `design_diff` | Structured diff between two screens | `projectId`, `screenId1`, `screenId2` | `includeStyleDiff`, `includeTextDiff` |

### Export Tools (4)

| Tool | Description | Required Parameters | Optional |
|------|-------------|-------------------|----------|
| `generate_style_guide` | Generate visual style guide from a screen | `projectId`, `screenId` | `sections[]`, `format` (visual/documentation/both) |
| `export_design_system` | Export complete design system package | `projectId` | `screenIds[]`, `includeTokens`, `includeComponents`, `tokenFormat`, `componentFormat` |
| `suggest_trending_design` | Apply modern design trends to a prompt | `projectId`, `prompt`, `trends[]` | `intensity`, `deviceType` |
| `export_all_screens` | Bulk export all screens (HTML + screenshots) | `projectId` | `includeHtml`, `includeScreenshots`, `maxScreens` |

**Available trends:** `glassmorphism`, `bento-grid`, `gradient-mesh`, `aurora-gradients`, `3d-elements`, `micro-interactions`, `dark-mode`, `minimalist`, `brutalist`, `neomorphism`, `retro-futurism`, `organic-shapes`, `bold-typography`

### Codegen Tools (1)

| Tool | Description | Required Parameters | Optional |
|------|-------------|-------------------|----------|
| `screen_to_react` | Convert screen to React/TSX with Tailwind CSS | `projectId`, `screenId` | `componentName`, `includeResponsive` |

### Integration Tools (1)

| Tool | Description | Required Parameters | Optional |
|------|-------------|-------------------|----------|
| `screen_to_plane_issue` | Generate PM issue data from a screen | `projectId`, `screenId` | `screenName`, `workspaceSlug`, `planeProjectId`, `priority`, `additionalContext` |

### Advanced Tools (6)

| Tool | Description | Required Parameters | Optional |
|------|-------------|-------------------|----------|
| `screen_to_tailwind_config` | Extract complete `tailwind.config.ts` | `projectId`, `screenId` | `prefix`, `includePlugins` |
| `screen_to_css_variables` | Extract CSS custom properties with semantic names | `projectId`, `screenId` | `includeDarkMode`, `namespace` |
| `validate_design_system` | Check screen compliance against design tokens | `projectId`, `screenId` | `approvedColors[]`, `approvedFonts[]`, `approvedSpacing[]`, `approvedRadii[]`, `strictMode` |
| `generate_dark_mode` | Generate dark-mode variant of a screen | `projectId`, `screenId` | `preserveAccents`, `contrast`, `deviceType` |
| `generate_component_variants` | Generate visual variants of a component | `projectId`, `screenId`, `componentType` | `variantCount`, `variantStyles[]`, `deviceType` |
| `project_summary` | High-level project overview with consistency score | `projectId` | `analyzeConsistency`, `maxScreensToAnalyze` |

## Architecture

```
src/
├── index.ts              # Entry point — MCP server setup, tool routing, project resolution
├── auth.ts               # Authentication (API key, access token, gcloud CLI fallback)
├── stitch-client.ts      # JSON-RPC client, download helpers, screen list parser
├── types.ts              # TypeScript interfaces (auth, RPC, tools, design context)
└── tools/
    ├── helpers.ts         # Shared utilities (extractUnique, extractCssValues, validators)
    ├── upstream.ts        # Proxy to upstream Stitch tools (7 tools)
    ├── code.ts            # Screen code/image retrieval, site building (4 tools)
    ├── workspace.ts       # Workspace project management (3 tools)
    ├── design.ts          # Design context, tokens, responsive, batch, templates (6 tools)
    ├── analysis.ts        # Accessibility, comparison, components, design diff (4 tools)
    ├── export.ts          # Style guides, design system export, trends, bulk export (4 tools)
    ├── codegen.ts         # Screen-to-React conversion (1 tool)
    ├── integration.ts     # Screen-to-PM-issue bridge (1 tool)
    └── advanced.ts        # Tailwind config, CSS vars, validation, dark mode, variants, summary (6 tools)
```

### Key Design Decisions

- **Modular tool files** — Each category has its own file with definitions and handlers
- **Shared helpers** — Common HTML extraction functions centralised in `helpers.ts`
- **Input validation** — All required parameters validated with `requireString`/`requireNonEmptyArray`
- **Auto project resolution** — Three-tier lookup: argument > session cache > `.stitch-project.json`
- **Timeout protection** — All HTTP requests (RPC, downloads) have configurable timeouts
- **Immutable patterns** — Tool definitions are `readonly`, args are spread (never mutated)

## Integration

### Claude Code / Claude Desktop

Add to your MCP config file (`.mcp.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "stitch": {
      "command": "node",
      "args": ["/path/to/stitch-mcp-server/dist/index.js"],
      "env": {
        "STITCH_API_KEY": "your-api-key"
      }
    }
  }
}
```

### MCPJungle

```json
{
  "name": "stitch",
  "command": "node",
  "args": ["/path/to/stitch-mcp-server/dist/index.js"],
  "env": {
    "STITCH_API_KEY": "your-api-key"
  },
  "tags": ["design", "ui", "stitch", "google"]
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "node",
      "args": ["/path/to/stitch-mcp-server/dist/index.js"],
      "env": {
        "STITCH_API_KEY": "your-api-key"
      }
    }
  }
}
```

### VS Code (Copilot MCP)

Add to your VS Code settings:

```json
{
  "mcp.servers": {
    "stitch": {
      "command": "node",
      "args": ["/path/to/stitch-mcp-server/dist/index.js"],
      "env": {
        "STITCH_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STITCH_API_KEY` | One of three | Google API key for Stitch access |
| `STITCH_ACCESS_TOKEN` | One of three | OAuth2 access token |
| `GOOGLE_CLOUD_PROJECT` | Optional | GCP project ID for billing (Bearer auth) |
| `GCLOUD_PROJECT` | Optional | Alias for `GOOGLE_CLOUD_PROJECT` |
| `STITCH_HOST` | Optional | Override the Stitch API endpoint URL (default: `https://stitch.googleapis.com/mcp`) |

## Examples

### 1. Design-to-Code Workflow

```
User: "Generate a dashboard screen and convert it to React"

1. generate_screen_from_text → Creates the design in Stitch
2. get_screen_code           → Fetches the HTML
3. screen_to_react           → Converts to a React/TSX component with Tailwind
4. screen_to_tailwind_config → Extracts a matching tailwind.config.ts
```

### 2. Design System Audit

```
User: "Check if our screens follow the design system"

1. project_summary          → Overview of all screens with consistency score
2. validate_design_system   → Check each screen against approved tokens
3. compare_designs          → Compare inconsistent screens side-by-side
4. export_design_system     → Export the corrected design system for handoff
```

### 3. Dark Mode Generation

```
User: "Create a dark mode version of our app"

1. list_screens             → Find all screens in the project
2. extract_design_context   → Extract the current design DNA
3. generate_dark_mode       → Generate dark variants for each screen
4. screen_to_css_variables  → Export CSS vars with dark-mode overrides
```

### 4. Component Library Build

```
User: "Build a component library from our designs"

1. extract_components           → Pull buttons, cards, forms, nav from a screen
2. generate_component_variants  → Create 3-5 visual variants of each component
3. screen_to_react              → Convert each variant to React
4. generate_style_guide         → Create visual documentation
```

### 5. Bulk Project Export

```
User: "Export everything from this project for handoff"

1. project_summary        → Get the full project overview
2. export_all_screens     → Bulk export all HTML + screenshots
3. export_design_system   → Export tokens, components, and documentation
4. generate_design_tokens → Generate CSS variables and Tailwind config
```

### 6. Rapid Prototyping with Templates

```
User: "Create a SaaS app prototype"

1. generate_from_template → "dashboard" with "dark theme, analytics focus"
2. generate_from_template → "settings" with "minimal style, dark theme"
3. generate_from_template → "pricing" with "3 tiers, annual toggle"
4. generate_from_template → "login" with "social auth, dark background"
5. build_site             → Map all screens to routes
```

## Contributing

### Adding a New Tool

1. **Choose the right module** — Pick the tool file that matches the category, or create a new one
2. **Define the tool** — Add a `ToolDefinition` to the module's definitions array
3. **Implement the handler** — Write an async function that returns `McpToolResult`
4. **Register in the dispatcher** — Add a `case` to the module's switch statement
5. **Wire into index.ts** — If it's a new module, import it and add to the routing logic
6. **Add to TOOLS_REQUIRING_PROJECT** — If the tool needs a `projectId`
7. **Build and test** — Run `npm run build` and verify the tool appears in `list_tools`

### Tool Handler Pattern

```typescript
async function handleMyNewTool(
  args: Record<string, unknown>,
  creds: AuthCredentials,
  projectId?: string
): Promise<McpToolResult> {
  // 1. Validate inputs
  const pid = requireString(args.projectId, "projectId");

  // 2. Fetch data
  const html = await fetchScreenHtml(pid, screenId, creds, projectId);

  // 3. Process
  const result = analyzeHtml(html);

  // 4. Return structured result
  return {
    content: [{
      type: "text",
      text: JSON.stringify({ success: true, ...result }, null, 2),
    }],
  };
}
```

## License

[Apache-2.0](LICENSE) -- Contributions welcome.
