import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";
import logger from "lib/logger";
import authorize from "lib/warden/authorize";
import hasWorkflowGrant from "lib/warden/workflowGrant";
import saveWorkflowVersion from "lib/workflows/versioning";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Collaborators for {@link canMutateWorkflow}. Defaults to the real Warden and
 * ACL implementations; tests inject fakes to exercise the combined decision.
 */
interface CanMutateWorkflowDeps {
  authorize?: typeof authorize;
  hasWorkflowGrant?: typeof hasWorkflowGrant;
}

/**
 * Decide whether a user may UPDATE or DELETE a specific workflow.
 *
 * Rule: (org admin) OR (holder of an `editor` grant on that workflow in the
 * `workflow_permission` ACL). This is strictly additive to the previous
 * org-admin-only rule: org admins keep full access and per-workflow editors
 * gain edit/delete rights. Fail-closed semantics are inherited from
 * `authorize` (Warden enabled but unreachable => deny) and from
 * `hasWorkflowGrant` (no matching grant => deny).
 *
 * @knipignore
 */
export const canMutateWorkflow = async (
  idpUserId: string,
  workflow: { id: string; organizationId: string },
  deps: CanMutateWorkflowDeps = {},
): Promise<boolean> => {
  const {
    authorize: authz = authorize,
    hasWorkflowGrant: grantCheck = hasWorkflowGrant,
  } = deps;

  const isOrgAdmin = await authz(
    idpUserId,
    "organization",
    workflow.organizationId,
    "admin",
  );
  if (isOrgAdmin) return true;

  return grantCheck(idpUserId, workflow.id, "editor");
};

/**
 * Validate workflow permissions via Warden.
 *
 * - Create: Any organization member can create (subject to plan limit)
 * - Update: Org admin OR a per-workflow editor grant can update
 * - Delete: Org admin OR a per-workflow editor grant can delete
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
      canMutateWorkflow,
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
              // Delete: org admin OR an editor grant on this specific workflow
              const workflow = await db.query.workflowTable.findFirst({
                where: (table: any, { eq }: any) => eq(table.id, input),
              });

              if (!workflow) throw new SafeError("Workflow not found");

              const allowed = await canMutateWorkflow(
                observer.identityProviderId,
                workflow,
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
      canMutateWorkflow,
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
      canMutateWorkflow,
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

            // Update: org admin OR an editor grant on this specific workflow
            const workflow = await db.query.workflowTable.findFirst({
              where: (table: any, { eq }: any) => eq(table.id, rowId),
            });

            if (!workflow) throw new SafeError("Workflow not found");

            const allowed = await canMutateWorkflow(
              observer.identityProviderId,
              workflow,
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
    [
      SafeError,
      context,
      sideEffect,
      saveWorkflowVersion,
      logger,
      canMutateWorkflow,
    ],
  );

/**
 * Authorization plugin for workflows.
 *
 * - Create: Any organization member (plan limit enforced)
 * - Update: Org admin OR per-workflow editor grant (auto-saves version on
 *   definition change)
 * - Delete: Org admin OR per-workflow editor grant
 */
const WorkflowPlugin = wrapPlans({
  Mutation: {
    createWorkflow: validatePermissions("workflow", "create"),
    updateWorkflow: validateUpdatePermissions(),
    deleteWorkflow: validatePermissions("rowId", "delete"),
  },
});

export default WorkflowPlugin;
