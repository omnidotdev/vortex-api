import { and, asc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { dbPool as db } from "lib/db/db";
import { userOrganizationTable, userTable } from "lib/db/schema";
import logger from "lib/logger";
import {
  grantOrganizationRole,
  revokeOrganizationRole,
} from "lib/warden/organization";

/**
 * Resolve the caller's local user and org membership.
 *
 * The `idpUserId` is the IDP identity provider ID, which maps
 * to `userTable.identityProviderId`. We look up the local user and
 * their membership in the given organization.
 *
 * @param idpUserId - Identity provider user ID
 * @param organizationId - Organization to check membership in
 */
async function resolveCallerMembership(
  idpUserId: string,
  organizationId: string,
) {
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.identityProviderId, idpUserId),
    columns: { id: true },
  });

  if (!user) return null;

  const membership = await db.query.userOrganizationTable.findFirst({
    where: and(
      eq(userOrganizationTable.userId, user.id),
      eq(userOrganizationTable.organizationId, organizationId),
    ),
    columns: { role: true },
  });

  if (!membership) return null;

  return { localUserId: user.id, role: membership.role };
}

/**
 * Organization member management endpoints.
 *
 * Provides listing, role updates, and member removal for
 * organization membership management.
 */
const membersRoutes = new Elysia({
  prefix: "/organizations/:orgId/members",
})
  /**
   * List organization members.
   * GET /api/v1/organizations/:orgId/members
   *
   * Any org member can view. Returns members sorted by role
   * (owner first, then admin, then member), then by name.
   */
  .get(
    "/",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);

      if (!authInfo) {
        return status(401, { error: "Invalid or missing credentials" });
      }

      const { organizationId } = authInfo;
      const { orgId } = params;

      // Verify the API key belongs to the requested organization
      if (orgId !== organizationId) {
        return status(403, { error: "Access denied" });
      }

      // Fetch members with user details via join
      const members = await db
        .select({
          userId: userOrganizationTable.userId,
          name: userTable.name,
          email: userTable.email,
          avatarUrl: userTable.avatarUrl,
          role: userOrganizationTable.role,
          joinedAt: userOrganizationTable.createdAt,
        })
        .from(userOrganizationTable)
        .innerJoin(userTable, eq(userOrganizationTable.userId, userTable.id))
        .where(eq(userOrganizationTable.organizationId, orgId))
        .orderBy(
          // Sort by role weight (owner=0, admin=1, member=2), then name
          sql`CASE ${userOrganizationTable.role}
            WHEN 'owner' THEN 0
            WHEN 'admin' THEN 1
            WHEN 'member' THEN 2
          END`,
          asc(userTable.name),
        );

      return { members };
    },
    {
      params: t.Object({
        orgId: t.String(),
      }),
    },
  )

  /**
   * Update a member's role.
   * PATCH /api/v1/organizations/:orgId/members/:userId/role
   *
   * Owner only. Cannot promote to "owner" (use ownership transfer).
   * Cannot change own role.
   */
  .patch(
    "/:userId/role",
    async ({ params, body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);

      if (!authInfo) {
        return status(401, { error: "Invalid or missing credentials" });
      }

      const { organizationId, userId: idpUserId } = authInfo;
      const { orgId, userId: targetUserId } = params;
      const { role: newRole } = body;

      // Verify credentials belong to the requested organization
      if (orgId !== organizationId) {
        return status(403, { error: "Access denied" });
      }

      // Resolve the caller's identity and role
      if (!idpUserId) {
        return status(403, {
          error: "Credentials do not have an associated user identity",
        });
      }

      const caller = await resolveCallerMembership(idpUserId, orgId);

      if (!caller) {
        return status(403, { error: "Access denied" });
      }

      // Only owners can change roles
      if (caller.role !== "owner") {
        return status(403, {
          error: "Only organization owners can change member roles",
        });
      }

      // Cannot change own role
      if (caller.localUserId === targetUserId) {
        return status(400, { error: "Cannot change your own role" });
      }

      // Verify target user is a member of the organization
      const targetMembership = await db.query.userOrganizationTable.findFirst({
        where: and(
          eq(userOrganizationTable.userId, targetUserId),
          eq(userOrganizationTable.organizationId, orgId),
        ),
        columns: { role: true },
      });

      if (!targetMembership) {
        return status(404, { error: "Member not found" });
      }

      // Cannot change the owner's role
      if (targetMembership.role === "owner") {
        return status(400, {
          error: "Cannot change the owner's role",
        });
      }

      // Skip if role is already the same
      if (targetMembership.role === newRole) {
        return { success: true };
      }

      // Update role in database
      await db
        .update(userOrganizationTable)
        .set({
          role: newRole,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(userOrganizationTable.userId, targetUserId),
            eq(userOrganizationTable.organizationId, orgId),
          ),
        );

      // Sync role change to Warden
      try {
        // Revoke old role, grant new role
        await revokeOrganizationRole(
          orgId,
          targetUserId,
          targetMembership.role,
        );
        await grantOrganizationRole(orgId, targetUserId, newRole);
      } catch (err) {
        logger.warn("Failed to sync role change to Warden", {
          organizationId: orgId,
          userId: targetUserId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      logger.info("Member role updated", {
        organizationId: orgId,
        targetUserId,
        oldRole: targetMembership.role,
        newRole,
      });

      return { success: true };
    },
    {
      params: t.Object({
        orgId: t.String(),
        userId: t.String(),
      }),
      body: t.Object({
        role: t.Union([t.Literal("admin"), t.Literal("member")]),
      }),
    },
  )

  /**
   * Remove a member from the organization.
   * DELETE /api/v1/organizations/:orgId/members/:userId
   *
   * Admin+ can remove members. Cannot remove the owner or self.
   */
  .delete(
    "/:userId",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);

      if (!authInfo) {
        return status(401, { error: "Invalid or missing credentials" });
      }

      const { organizationId, userId: idpUserId } = authInfo;
      const { orgId, userId: targetUserId } = params;

      // Verify credentials belong to the requested organization
      if (orgId !== organizationId) {
        return status(403, { error: "Access denied" });
      }

      // Resolve the caller's identity and role
      if (!idpUserId) {
        return status(403, {
          error: "Credentials do not have an associated user identity",
        });
      }

      const caller = await resolveCallerMembership(idpUserId, orgId);

      if (!caller) {
        return status(403, { error: "Access denied" });
      }

      // Only admin+ can remove members
      if (caller.role === "member") {
        return status(403, {
          error: "Only admins and owners can remove members",
        });
      }

      // Cannot remove self
      if (caller.localUserId === targetUserId) {
        return status(400, {
          error: "Cannot remove yourself from the organization",
        });
      }

      // Verify target is a member and check their role
      const targetMembership = await db.query.userOrganizationTable.findFirst({
        where: and(
          eq(userOrganizationTable.userId, targetUserId),
          eq(userOrganizationTable.organizationId, orgId),
        ),
        columns: { role: true },
      });

      if (!targetMembership) {
        return status(404, { error: "Member not found" });
      }

      // Cannot remove the owner
      if (targetMembership.role === "owner") {
        return status(400, {
          error: "Cannot remove the organization owner",
        });
      }

      // Admins cannot remove other admins (only owners can)
      if (caller.role === "admin" && targetMembership.role === "admin") {
        return status(403, {
          error: "Admins cannot remove other admins",
        });
      }

      // Delete membership
      await db
        .delete(userOrganizationTable)
        .where(
          and(
            eq(userOrganizationTable.userId, targetUserId),
            eq(userOrganizationTable.organizationId, orgId),
          ),
        );

      // Revoke Warden permissions
      try {
        await revokeOrganizationRole(
          orgId,
          targetUserId,
          targetMembership.role,
        );
      } catch (err) {
        logger.warn("Failed to revoke Warden permissions", {
          organizationId: orgId,
          userId: targetUserId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      logger.info("Member removed from organization", {
        organizationId: orgId,
        targetUserId,
        removedRole: targetMembership.role,
      });

      return { success: true };
    },
    {
      params: t.Object({
        orgId: t.String(),
        userId: t.String(),
      }),
    },
  );

export default membersRoutes;
