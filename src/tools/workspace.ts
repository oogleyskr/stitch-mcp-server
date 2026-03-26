/**
 * Workspace tools — manage the association between a local workspace directory
 * and a Stitch project via a .stitch-project.json file.
 *
 * Ported from GreenSheep01201/stitch-mcp-auto workspace project management.
 */

import * as fs from "fs";
import * as path from "path";
import type { ToolDefinition, McpToolResult, WorkspaceProject, ResolvedProject } from "../types";
import { requireString } from "./helpers";

/** Name of the local project config file. */
const LOCAL_PROJECT_FILE = ".stitch-project.json";

/** In-memory cache of the active project for the current session. */
let activeProject: WorkspaceProject | null = null;

/** Tool definitions for workspace management tools. */
export const workspaceToolDefinitions: readonly ToolDefinition[] = [
  {
    name: "get_workspace_project",
    description:
      "Checks if there is an existing Stitch project associated with the current workspace/folder. Returns project info if found, or null if no project is set. Use this at the start of a session to check for existing projects.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "set_workspace_project",
    description:
      "Associates a Stitch project with the current workspace/folder. The project info is stored in .stitch-project.json in the current directory.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The Stitch project ID (e.g., 'projects/1234567890').",
        },
        projectName: {
          type: "string",
          description: "Human-readable project name for display.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "clear_workspace_project",
    description:
      "Removes the Stitch project association from the current workspace/folder.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

/**
 * Returns the absolute path to the local project file in the current working directory.
 */
function getLocalProjectPath(): string {
  return path.join(process.cwd(), LOCAL_PROJECT_FILE);
}

/**
 * Loads the workspace project from disk.
 *
 * @returns The project data or null if none exists.
 */
function loadLocalProject(): WorkspaceProject | null {
  const projectPath = getLocalProjectPath();
  if (fs.existsSync(projectPath)) {
    try {
      return JSON.parse(fs.readFileSync(projectPath, "utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Saves workspace project data to disk and updates the session cache.
 *
 * @param data - The project data to persist.
 */
function saveLocalProject(data: WorkspaceProject): void {
  fs.writeFileSync(getLocalProjectPath(), JSON.stringify(data, null, 2));
  activeProject = data;
}

/**
 * Clears the workspace project association.
 *
 * @returns true if a file was deleted, false otherwise.
 */
function clearLocalProject(): boolean {
  const projectPath = getLocalProjectPath();
  if (fs.existsSync(projectPath)) {
    fs.unlinkSync(projectPath);
    activeProject = null;
    return true;
  }
  return false;
}

/**
 * Resolves the project ID from multiple sources with priority:
 *   1. Explicit argument
 *   2. In-memory session cache
 *   3. .stitch-project.json on disk
 *
 * @param argsProjectId - Project ID from tool arguments (may be undefined).
 */
export function resolveProjectId(argsProjectId?: string): ResolvedProject {
  if (argsProjectId) {
    return { projectId: argsProjectId, source: "argument" };
  }

  if (activeProject?.projectId) {
    return {
      projectId: activeProject.projectId,
      source: "session",
      projectName: activeProject.projectName ?? undefined,
    };
  }

  const local = loadLocalProject();
  if (local?.projectId) {
    activeProject = local;
    return {
      projectId: local.projectId,
      source: "workspace",
      projectName: local.projectName ?? undefined,
    };
  }

  return { projectId: null, source: "none" };
}

/**
 * Dispatches a workspace tool call.
 *
 * @param name - Tool name.
 * @param args - Tool arguments.
 */
export async function handleWorkspaceTool(
  name: string,
  args: Record<string, unknown>
): Promise<McpToolResult> {
  try {
    switch (name) {
      case "get_workspace_project": {
        const project = loadLocalProject();
        if (project?.projectId) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    found: true,
                    projectId: project.projectId,
                    projectName: project.projectName ?? null,
                    lastUsed: project.lastUsed ?? null,
                    workspacePath: process.cwd(),
                    message: `Found existing project: ${project.projectName ?? project.projectId}. Would you like to continue with this project?`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  found: false,
                  workspacePath: process.cwd(),
                  message:
                    "No project associated with current workspace. Please create a new project or select an existing one.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "set_workspace_project": {
        const validProjectId = requireString(args.projectId, "projectId");
        const projectData: WorkspaceProject = {
          projectId: validProjectId,
          projectName: (args.projectName as string) ?? null,
          lastUsed: new Date().toISOString(),
          workspacePath: process.cwd(),
        };
        saveLocalProject(projectData);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  projectId: projectData.projectId,
                  projectName: projectData.projectName,
                  savedTo: getLocalProjectPath(),
                  message:
                    "Project saved to workspace. This project will be automatically loaded in future sessions.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "clear_workspace_project": {
        const cleared = clearLocalProject();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  cleared,
                  workspacePath: process.cwd(),
                  message: "Workspace project association has been cleared.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown workspace tool: ${name}` }],
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
