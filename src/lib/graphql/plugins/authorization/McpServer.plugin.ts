import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { PLATFORM_ORG_ID } from "lib/config/env.config";
import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";
import { validateMcpServerConfig } from "lib/validation/mcpServer";
import authorize from "lib/warden/authorize";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate MCP server permissions via Warden.
 *
 * - Create: Admin+ can add MCP servers (subject to plan limit)
 * - Update: Admin+ can update MCP server config
 * - Delete: Admin+ can remove MCP servers
 *
 * Create and update also enforce the transport policy: only the platform org
 * may register stdio servers (a process spawned in the worker pod); every
 * other org is limited to remote (sse or http) servers
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
      authorize,
      validateMcpServerConfig,
      PLATFORM_ORG_ID,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]) as any;
        const $patch = fieldArgs.getRaw(["input", "patch"]) as any;
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect(
          [$input, $patch, $observer, $db],
          async ([input, patch, observer, db]: readonly any[]) => {
            if (!observer) throw new SafeError("Unauthorized");

            if (scope === "create") {
              const organizationId = input.organizationId;

              const allowed = await authorize(
                observer.identityProviderId,
                "organization",
                organizationId,
                "admin",
              );
              if (!allowed) throw new SafeError("Unauthorized");

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

              validateMcpServerConfig(organizationId, input, PLATFORM_ORG_ID);
            } else {
              const mcpServer = await db.query.mcpServerTable.findFirst({
                where: (table: any, { eq }: any) => eq(table.id, input),
              });

              if (!mcpServer) throw new SafeError("MCP server not found");

              const allowed = await authorize(
                observer.identityProviderId,
                "organization",
                mcpServer.organizationId,
                "admin",
              );
              if (!allowed) throw new SafeError("Unauthorized");

              // Validate the row as it will look after the patch
              if (scope === "update") {
                validateMcpServerConfig(
                  mcpServer.organizationId,
                  { ...mcpServer, ...(patch ?? {}) },
                  PLATFORM_ORG_ID,
                );
              }
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
      authorize,
      validateMcpServerConfig,
      PLATFORM_ORG_ID,
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
