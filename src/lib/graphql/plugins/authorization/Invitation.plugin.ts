import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate invitation permissions.
 *
 * - Create: Admin+ can invite new members
 * - Update: Admin+ can update invitation (resend, change role)
 * - Delete: Admin+ can cancel invitation
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (context, sideEffect, propName, scope): PlanWrapperFn =>
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
              },
            });

            if (!workspace?.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");

            // Only owner can invite admins
            if (input.role === "admin" && role !== "owner")
              throw new Error("Unauthorized");
          } else {
            // Update/delete: verify workspace membership and admin+ role
            const invitation = await db.query.invitationTable.findFirst({
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

            if (!invitation?.workspace.workspaceUsers.length)
              throw new Error("Unauthorized");

            const role = invitation.workspace.workspaceUsers[0].role;
            if (role === "member") throw new Error("Unauthorized");

            // Only owner can manage admin invitations
            if (invitation.role === "admin" && role !== "owner")
              throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [context, sideEffect, propName, scope],
  );

/**
 * Authorization plugin for workspace invitations.
 *
 * - Create: Admin+ role required
 * - Update: Admin+ role required
 * - Delete: Admin+ role required
 */
const InvitationPlugin = wrapPlans({
  Mutation: {
    createInvitation: validatePermissions("invitation", "create"),
    updateInvitation: validatePermissions("rowId", "update"),
    deleteInvitation: validatePermissions("rowId", "delete"),
  },
});

export default InvitationPlugin;
