import { SafeError } from "postgraphile/grafast";

/** The MCP server fields that decide how the worker reaches the server */
export interface McpServerTransportConfig {
  transport?: string | null;
  command?: string | null;
  args?: unknown;
  env?: unknown;
  cwd?: string | null;
  url?: string | null;
}

const REMOTE_TRANSPORTS = new Set(["sse", "http"]);

const isEmpty = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

/**
 * Enforce the MCP transport policy for a server owned by `organizationId`.
 *
 * A stdio server is a process the worker spawns inside its own pod, so only
 * the platform org may register one. Every other org must use a remote
 * transport (sse or http) with a url and no spawn fields (command, args, env,
 * cwd). With no platform org configured, every org is treated as a tenant.
 * The worker enforces the same rule before it connects
 */
export function validateMcpServerConfig(
  organizationId: string,
  config: McpServerTransportConfig,
  platformOrgId: string | undefined,
): void {
  if (platformOrgId && organizationId === platformOrgId) return;

  const transport = config.transport ?? "stdio";

  if (!REMOTE_TRANSPORTS.has(transport)) {
    throw new SafeError(
      "Only remote MCP servers (sse or http transport) are supported",
    );
  }

  if (!config.url) {
    throw new SafeError("A url is required for a remote MCP server");
  }

  if (
    !isEmpty(config.command) ||
    !isEmpty(config.args) ||
    !isEmpty(config.env) ||
    !isEmpty(config.cwd)
  ) {
    throw new SafeError(
      "command, args, env and cwd are not supported for remote MCP servers",
    );
  }
}
