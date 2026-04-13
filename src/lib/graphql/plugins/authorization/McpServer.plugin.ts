import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate MCP server permissions.
 *
 * - Create: Admin+ can add MCP servers (subject to plan limit)
 * - Update: Admin+ can update MCP server config
 * - Delete: Admin+ can remove MCP servers
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      SafeError,
      context,
      sideEffect,
      propName,
      scope,
      getPlanLimit,
      assertUnderLimit,
      FEATURE_KEYS,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]) as any;
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect(
          [$input, $observer, $db],
          async ([input, observer, db]: readonly any[]) => {
            if (!observer) throw new SafeError("Unauthorized");

            if (scope === "create") {
              const organizationId = input.organizationId;

              // Verify organization membership and admin+ role
              const membership = await db.query.userOrganizationTable.findFirst(
                {
                  where: (table: any, { and, eq }: any) =>
                    and(
                      eq(table.userId, observer.id),
                      eq(table.organizationId, organizationId),
                    ),
                },
              );

              if (!membership) throw new SafeError("Unauthorized");
              if (membership.role === "member")
                throw new SafeError("Unauthorized");

              // Enforce plan limit
              const [limit, existing] = await Promise.all([
                getPlanLimit(organizationId, FEATURE_KEYS.MAX_MCP_SERVERS),
                db.query.mcpServerTable.findMany({
                  where: (table: any, { eq }: any) =>
                    eq(table.organizationId, organizationId),
                  columns: { id: true },
                }),
              ]);
              assertUnderLimit(limit, existing.length, "MCP servers");
            } else {
              // Update/delete: verify organization membership and admin+ role
              const mcpServer = await db.query.mcpServerTable.findFirst({
                where: (table: any, { eq }: any) => eq(table.id, input),
              });

              if (!mcpServer) throw new SafeError("MCP server not found");

              const membership = await db.query.userOrganizationTable.findFirst(
                {
                  where: (table: any, { and, eq }: any) =>
                    and(
                      eq(table.userId, observer.id),
                      eq(table.organizationId, mcpServer.organizationId),
                    ),
                },
              );

              if (!membership) throw new SafeError("Unauthorized");
              if (membership.role === "member")
                throw new SafeError("Unauthorized");
            }
          },
        );

        return plan();
      },
    [
      SafeError,
      context,
      sideEffect,
      propName,
      scope,
      getPlanLimit,
      assertUnderLimit,
      FEATURE_KEYS,
    ],
  );

/**
 * Authorization plugin for MCP servers.
 *
 * - Create: Admin+ role required (plan limit enforced)
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
