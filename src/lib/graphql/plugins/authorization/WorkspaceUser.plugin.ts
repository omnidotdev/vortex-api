import { EXPORTABLE } from "graphile-export";
import { context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import {
  BASIC_TIER_MAX_ADMINS,
  BASIC_TIER_MAX_MEMBERS,
  FREE_TIER_MAX_ADMINS,
  FREE_TIER_MAX_MEMBERS,
} from "./constants";

import type { PlanWrapperFn } from "postgraphile/utils";
import type { MutationScope } from "./types";

/**
 * Validate workspace user permissions.
 *
 * - Create (invite): Admin+ can invite new members
 * - Update (role change): Admin+ can change roles (owner can promote to admin)
 * - Delete (remove): Admin+ can remove members, owner can remove admins
 */
const validatePermissions = (propName: string, scope: MutationScope) =>
  EXPORTABLE(
    (
      context,
      sideEffect,
      FREE_TIER_MAX_ADMINS,
      FREE_TIER_MAX_MEMBERS,
      BASIC_TIER_MAX_ADMINS,
      BASIC_TIER_MAX_MEMBERS,
      propName,
      scope,
    ): PlanWrapperFn =>
      (plan, _, fieldArgs) => {
        const $input = fieldArgs.getRaw(["input", propName]);
        const $observer = context().get("observer");
        const $db = context().get("db");

        sideEffect([$input, $observer, $db], async ([input, observer, db]) => {
          if (!observer) throw new Error("Unauthorized");

          // Get the workspace for this operation
          const workspaceId =
            scope === "create" ? input.workspaceId : input.workspaceId;

          const workspace = await db.query.workspaceTable.findFirst({
            where: (table, { eq }) => eq(table.id, workspaceId),
            with: {
              workspaceUsers: true,
            },
          });

          if (!workspace) throw new Error("Workspace not found");

          // Find observer's role in this workspace
          const observerMembership = workspace.workspaceUsers.find(
            (wu) => wu.userId === observer.id,
          );

          if (!observerMembership) throw new Error("Unauthorized");

          const observerRole = observerMembership.role;

          // Members cannot manage team
          if (observerRole === "member") throw new Error("Unauthorized");

          if (scope === "create") {
            // Check tier limits for new members
            const memberCount = workspace.workspaceUsers.length;
            const adminCount = workspace.workspaceUsers.filter(
              (wu) => wu.role === "admin" || wu.role === "owner",
            ).length;

            const maxMembers =
              workspace.tier === "free"
                ? FREE_TIER_MAX_MEMBERS
                : workspace.tier === "basic"
                  ? BASIC_TIER_MAX_MEMBERS
                  : Infinity;

            if (memberCount >= maxMembers)
              throw new Error("Maximum team members reached for your plan");

            // Check admin limit if adding as admin
            if (input.role === "admin") {
              const maxAdmins =
                workspace.tier === "free"
                  ? FREE_TIER_MAX_ADMINS
                  : workspace.tier === "basic"
                    ? BASIC_TIER_MAX_ADMINS
                    : Infinity;

              if (adminCount >= maxAdmins)
                throw new Error("Maximum admins reached for your plan");

              // Only owner can add admins
              if (observerRole !== "owner") throw new Error("Unauthorized");
            }
          } else if (scope === "update") {
            // Role changes
            const targetMembership = workspace.workspaceUsers.find(
              (wu) => wu.userId === input.userId,
            );

            if (!targetMembership)
              throw new Error("User not found in workspace");

            // Cannot change owner's role
            if (targetMembership.role === "owner")
              throw new Error("Cannot change owner role");

            // Only owner can promote to admin
            if (input.role === "admin" && observerRole !== "owner")
              throw new Error("Unauthorized");

            // Admins cannot demote other admins
            if (targetMembership.role === "admin" && observerRole !== "owner")
              throw new Error("Unauthorized");
          } else if (scope === "delete") {
            const targetMembership = workspace.workspaceUsers.find(
              (wu) => wu.userId === input.userId,
            );

            if (!targetMembership)
              throw new Error("User not found in workspace");

            // Cannot remove owner
            if (targetMembership.role === "owner")
              throw new Error("Cannot remove workspace owner");

            // Admins cannot remove other admins
            if (targetMembership.role === "admin" && observerRole !== "owner")
              throw new Error("Unauthorized");
          }
        });

        return plan();
      },
    [
      context,
      sideEffect,
      FREE_TIER_MAX_ADMINS,
      FREE_TIER_MAX_MEMBERS,
      BASIC_TIER_MAX_ADMINS,
      BASIC_TIER_MAX_MEMBERS,
      propName,
      scope,
    ],
  );

/**
 * Authorization plugin for workspace users (team management).
 *
 * - Create: Admin+ can invite
 * - Update: Admin+ can change roles (with restrictions)
 * - Delete: Admin+ can remove (with restrictions)
 */
const WorkspaceUserPlugin = wrapPlans({
  Mutation: {
    createWorkspaceUser: validatePermissions("workspaceUser", "create"),
    updateWorkspaceUser: validatePermissions("workspaceUser", "update"),
    deleteWorkspaceUser: validatePermissions("workspaceUser", "delete"),
  },
});

export default WorkspaceUserPlugin;
