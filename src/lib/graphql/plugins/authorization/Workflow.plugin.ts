import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";
import logger from "lib/logger";
import authorize from "lib/warden/authorize";
import saveWorkflowVersion from "lib/workflows/versioning";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate workflow permissions via Warden.
 *
 * - Create: Any organization member can create (subject to plan limit)
 * - Update: Admin+ can update workflows
 * - Delete: Admin+ can delete workflows
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

              // Verify organization membership via Warden
              const allowed = await authorize(
                observer.identityProviderId,
                "organization",
                organizationId,
                "member",
              );
              if (!allowed) throw new SafeError("Unauthorized");

              // Enforce plan limit
              const [limit, existing] = await Promise.all([
                getPlanLimit(organizationId, FEATURE_KEYS.MAX_WORKFLOWS),
                db.query.workflowTable.findMany({
                  where: (table: any, { eq }: any) =>
                    eq(table.organizationId, organizationId),
                  columns: { id: true },
                }),
              ]);
              assertUnderLimit(limit, existing.length, "workflows");
            } else {
              // Update/delete: verify admin+ via Warden on the workflow's org
              const workflow = await db.query.workflowTable.findFirst({
                where: (table: any, { eq }: any) => eq(table.id, input),
              });

              if (!workflow) throw new SafeError("Workflow not found");

              const allowed = await authorize(
                observer.identityProviderId,
                "organization",
                workflow.organizationId,
                "admin",
              );
              if (!allowed) throw new SafeError("Unauthorized");
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
    ],
  );

/**
 * Validate update permissions and auto-save a version snapshot when
 * the workflow definition changes.
 */
const validateUpdatePermissions = (): PlanWrapperFn =>
  EXPORTABLE(
    (
      SafeError,
      context,
      sideEffect,
      saveWorkflowVersion,
      logger,
      authorize,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $rowId = fieldArgs.getRaw(["input", "rowId"]) as any;
        const $patch = fieldArgs.getRaw(["input", "patch"]) as any;
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect(
          [$rowId, $patch, $observer, $db],
          async ([rowId, patch, observer, db]: readonly any[]) => {
            if (!observer) throw new SafeError("Unauthorized");

            // Verify admin+ role via Warden
            const workflow = await db.query.workflowTable.findFirst({
              where: (table: any, { eq }: any) => eq(table.id, rowId),
            });

            if (!workflow) throw new SafeError("Workflow not found");

            const allowed = await authorize(
              observer.identityProviderId,
              "organization",
              workflow.organizationId,
              "admin",
            );
            if (!allowed) throw new SafeError("Unauthorized");

            // Auto-save version snapshot when definition changes
            if (patch?.definition !== undefined) {
              const oldDef = JSON.stringify(workflow.definition);
              const newDef = JSON.stringify(patch.definition);

              if (oldDef !== newDef) {
                try {
                  await saveWorkflowVersion({
                    workflowId: rowId as string,
                    definition: workflow.definition,
                    createdBy: observer.id,
                  });
                } catch (err) {
                  logger.warn("Failed to save workflow version snapshot", {
                    workflowId: rowId,
                    error: err instanceof Error ? err.message : String(err),
                  });
                }
              }
            }
          },
        );

        return plan();
      },
    [SafeError, context, sideEffect, saveWorkflowVersion, logger, authorize],
  );

/**
 * Authorization plugin for workflows.
 *
 * - Create: Any organization member (plan limit enforced)
 * - Update: Admin+ role required (auto-saves version on definition change)
 * - Delete: Admin+ role required
 */
const WorkflowPlugin = wrapPlans({
  Mutation: {
    createWorkflow: validatePermissions("workflow", "create"),
    updateWorkflow: validateUpdatePermissions(),
    deleteWorkflow: validatePermissions("rowId", "delete"),
  },
});

export default WorkflowPlugin;
