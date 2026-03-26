# Stitch MCP Server

A combined MCP (Model Context Protocol) server for [Google Stitch](https://stitch.googleapis.com) that merges the best of [davideast/stitch-mcp](https://github.com/davideast/stitch-mcp) and [GreenSheep01201/stitch-mcp-auto](https://github.com/GreenSheep01201/stitch-mcp-auto) into a clean, modular TypeScript codebase.

## Features

- **30 tools** across 8 categories
- **Three authentication methods** (API key, access token, gcloud CLI)
- **Workspace project management** — persist project associations per directory
- **Design analysis** — extract design DNA, compare screens, check accessibility
- **Design system export** — generate tokens, style guides, and component libraries
- **Upstream proxy** — full access to all Google Stitch MCP tools

## Authentication

Three methods, checked in priority order:

| Priority | Method | Environment Variable | Header Sent |
|----------|--------|---------------------|-------------|
| 1 | API Key | `STITCH_API_KEY` | `X-Goog-Api-Key` |
| 2 | Access Token | `STITCH_ACCESS_TOKEN` | `Authorization: Bearer` |
| 3 | gcloud CLI | *(auto-detected)* | `Authorization: Bearer` |

For Bearer-based auth, set `GOOGLE_CLOUD_PROJECT` to include the project header.

## Tool Reference

### Upstream Stitch Tools (7)

| Tool | Description |
|------|-------------|
| `list_projects` | List all accessible Stitch projects |
| `get_project` | Get project details |
| `list_screens` | List screens in a project |
| `get_screen` | Get screen details with download URLs |
| `generate_screen_from_text` | Generate a screen from a text prompt |
| `edit_screens` | Edit existing screens with text instructions |
| `generate_variants` | Generate design variants of a screen |

### Code & Build Tools (4)

| Tool | Description |
|------|-------------|
| `get_screen_code` | Fetch screen HTML content |
| `get_screen_image` | Fetch screen screenshot as base64 PNG |
| `build_site` | Map screens to routes, fetch all HTML |
| `list_tools` | List all available tools |

### Workspace Tools (3)

| Tool | Description |
|------|-------------|
| `get_workspace_project` | Check if workspace has a linked Stitch project |
| `set_workspace_project` | Link a project to the current workspace |
| `clear_workspace_project` | Remove the workspace project link |

### Design Tools (6)

| Tool | Description |
|------|-------------|
| `extract_design_context` | Extract colors, typography, spacing, components from a screen |
| `apply_design_context` | Generate a new screen using an extracted design context |
| `generate_design_tokens` | Generate CSS vars / Tailwind config / SCSS / JSON tokens |
| `generate_responsive_variant` | Create responsive version for a different viewport |
| `batch_generate_screens` | Generate multiple related screens consistently |
| `generate_from_template` | Generate screens from 10 predefined UI templates with customizations |

### Analysis Tools (4)

| Tool | Description |
|------|-------------|
| `analyze_accessibility` | WCAG 2.1 accessibility analysis |
| `compare_designs` | Compare two screens for design inconsistencies |
| `extract_components` | Extract reusable components as JSON/React/HTML/Vue |
| `design_diff` | Structured diff between two screens (elements, styles, text, classes) |

### Export Tools (4)

| Tool | Description |
|------|-------------|
| `generate_style_guide` | Generate a visual style guide from a screen |
| `export_design_system` | Export complete design system (tokens + components + docs) |
| `suggest_trending_design` | Apply modern design trends to a prompt |
| `export_all_screens` | Bulk export all screens (HTML + screenshots) from a project |

### Codegen Tools (1)

| Tool | Description |
|------|-------------|
| `screen_to_react` | Convert screen HTML to a React/TSX component with Tailwind CSS |

### Integration Tools (1)

| Tool | Description |
|------|-------------|
| `screen_to_plane_issue` | Generate structured Plane/PM issue data from a screen design |

## Setup

### Prerequisites

- Node.js 18+
- One of: `STITCH_API_KEY`, `STITCH_ACCESS_TOKEN`, or `gcloud` CLI configured

### Install & Build

```bash
npm install
npm run build
```

### MCP Configuration

Add to your MCP client config (e.g., `.mcp.json` or Claude Desktop settings):

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

Or with gcloud auth:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "node",
      "args": ["/path/to/stitch-mcp-server/dist/index.js"],
      "env": {
        "GOOGLE_CLOUD_PROJECT": "your-project-id"
      }
    }
  }
}
```

## Architecture

```
src/
├── index.ts           # Entry point, MCP server setup, tool routing
├── auth.ts            # Authentication (API key, access token, gcloud)
├── stitch-client.ts   # JSON-RPC client for Stitch MCP endpoint
├── types.ts           # TypeScript interfaces
└── tools/
    ├── upstream.ts    # Proxy to upstream Stitch tools
    ├── code.ts        # Screen code/image retrieval, site building
    ├── workspace.ts   # Workspace project management
    ├── design.ts      # Design context, tokens, responsive, batch
    ├── analysis.ts    # Accessibility, comparison, components, design diff
    ├── export.ts      # Style guides, design system export, trends, bulk export
    ├── codegen.ts     # Screen-to-React component conversion
    └── integration.ts # Screen-to-Plane-issue bridge
```

## License

Apache-2.0
