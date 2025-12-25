import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import {
  BASIC_TIER_MAX_MCP_SERVERS,
  FREE_TIER_MAX_MCP_SERVERS,
} from "./constants";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate MCP server permissions.
 *
 * - Create: Admin+ can add MCP servers (subject to tier limits)
 * - Update: Admin+ can update MCP server config
 * - Delete: Admin+ can remove MCP servers
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      context,
      sideEffect,
      FREE_TIER_MAX_MCP_SERVERS,
      BASIC_TIER_MAX_MCP_SERVERS,
      propName,
      scope,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new Error("Unauthorized");

          if (scope === "create") {
            const workspaceId = input.workspaceId;

            // Verify workspace membership and admin+ role
            const workspace = await db.query.workspaceTable.findFirst({
              where: (table, { eq }) => eq(table.id, workspaceId),
              with: {
                workspaceUsers: {
                  where: (table, { eq }) => eq(table.userId, observer.id),
                },
                mcpServers: true,
              },
            });

            if (!workspace?.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");

            // Check tier limits
            const mcpServerCount = workspace.mcpServers.length;
            const maxMcpServers =
              workspace.tier === "free"
                ? FREE_TIER_MAX_MCP_SERVERS
                : workspace.tier === "basic"
                  ? BASIC_TIER_MAX_MCP_SERVERS
                  : Infinity;

            if (mcpServerCount >= maxMcpServers)
              throw new Error("Maximum MCP servers reached for your plan");
          } else {
            // Update/delete: verify workspace membership and admin+ role
            const mcpServer = await db.query.mcpServerTable.findFirst({
              where: (table, { eq }) => eq(table.id, input),
              with: {
                workspace: {
                  with: {
                    workspaceUsers: {
                      where: (table, { eq }) => eq(table.userId, observer.id),
                    },
                  },
                },
              },
            });

            if (!mcpServer?.workspace.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = mcpServer.workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [
      context,
      sideEffect,
      FREE_TIER_MAX_MCP_SERVERS,
      BASIC_TIER_MAX_MCP_SERVERS,
      propName,
      scope,
    ],
  );

/**
 * Authorization plugin for MCP servers.
 *
 * - Create: Admin+ role required (subject to tier limits)
 * - Update: Admin+ role required
 * - Delete: Admin+ role required
 */
const McpServerPlugin = wrapPlans({
  Mutation: {
    createMcpServer: validatePermissions("mcpServer", "create"),
    updateMcpServer: validatePermissions("rowId", "update"),
    deleteMcpServer: validatePermissions("rowId", "delete"),
  },
});

export default McpServerPlugin;
