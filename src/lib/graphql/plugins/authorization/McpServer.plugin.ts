import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate MCP server permissions.
 *
 * - Create: Admin+ can add MCP servers
 * - Update: Admin+ can update MCP server config
 * - Delete: Admin+ can remove MCP servers
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (SafeError, context, sideEffect, propName, scope): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new SafeError("Unauthorized");

          if (scope === "create") {
            const organizationId = input.organizationId;

            // Verify organization membership and admin+ role
            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, organizationId),
                ),
            });

            if (!membership) throw new SafeError("Unauthorized");
            if (membership.role === "member")
              throw new SafeError("Unauthorized");
          } else {
            // Update/delete: verify organization membership and admin+ role
            const mcpServer = await db.query.mcpServerTable.findFirst({
              where: (table, { eq }) => eq(table.id, input),
            });

            if (!mcpServer) throw new SafeError("MCP server not found");

            const membership = await db.query.userOrganizationTable.findFirst({
              where: (table, { and, eq }) =>
                and(
                  eq(table.userId, observer.id),
                  eq(table.organizationId, mcpServer.organizationId),
                ),
            });

            if (!membership) throw new SafeError("Unauthorized");
            if (membership.role === "member")
              throw new SafeError("Unauthorized");
          }
        });

        return plan();
      },
    [SafeError, context, sideEffect, propName, scope],
  );

/**
 * Authorization plugin for MCP servers.
 *
 * - Create: Admin+ role required
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
