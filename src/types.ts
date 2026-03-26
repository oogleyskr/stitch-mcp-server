/**
 * TypeScript interfaces for the Stitch MCP Server.
 */

/** Authentication method used for the current session. */
export type AuthMethod = "api_key" | "access_token" | "gcloud";

/** Resolved authentication credentials. */
export interface AuthCredentials {
  /** The token or key value. */
  readonly token: string;
  /** Which authentication method produced this credential. */
  readonly method: AuthMethod;
  /** Optional GCP project ID for Bearer-based auth. */
  readonly projectId?: string;
}

/** JSON-RPC 2.0 request envelope sent to the Stitch MCP endpoint. */
export interface StitchJsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params: Record<string, unknown>;
  readonly id: number;
}

/** JSON-RPC 2.0 response envelope returned from the Stitch MCP endpoint. */
export interface StitchJsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

/** Shape of the upstream tool descriptor returned by tools/list. */
export interface StitchToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

/** Workspace project file (.stitch-project.json) shape. */
export interface WorkspaceProject {
  readonly projectId: string;
  readonly projectName: string | null;
  readonly lastUsed: string;
  readonly workspacePath: string;
}

/** Result of project ID resolution. */
export interface ResolvedProject {
  readonly projectId: string | null;
  readonly source: "argument" | "session" | "workspace" | "none";
  readonly projectName?: string;
}

/** Design context extracted from a screen's HTML. */
export interface DesignContext {
  readonly extractedFrom: { readonly projectId: string; readonly screenId: string };
  readonly extractedAt: string;
  readonly colors: {
    readonly primary: readonly string[];
    readonly secondary: readonly string[];
    readonly neutral: readonly string[];
    readonly accent: readonly string[];
  };
  readonly typography: {
    readonly fontFamilies: readonly string[];
    readonly fontSizes: readonly string[];
    readonly fontWeights: readonly string[];
    readonly lineHeights: readonly string[];
  };
  readonly spacing: {
    readonly margins: readonly string[];
    readonly paddings: readonly string[];
    readonly gaps: readonly string[];
  };
  readonly borderRadius: readonly string[];
  readonly shadows: readonly string[];
  readonly components: readonly string[];
  readonly layoutPatterns: readonly string[];
}

/** MCP tool content item. */
export interface McpContent {
  readonly type: "text" | "image";
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
}

/** MCP tool call result. */
export interface McpToolResult {
  readonly content: readonly McpContent[];
  readonly isError?: boolean;
}

/** A registered tool definition for the MCP server. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}
