import { asc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { dbPool as db } from "lib/db/db";
import { userOrganizationTable, userTable } from "lib/db/schema";

/**
 * Organization member read-only endpoint.
 *
 * Lists members from the local webhook-synced cache.
 * All member mutations (role changes, removal, invitations)
 * go through Gatekeeper via the frontend's server functions
 */
const membersRoutes = new Elysia({
  prefix: "/organizations/:orgId/members",
})
  /**
   * List organization members.
   * GET /api/v1/organizations/:orgId/members
   *
   * Any org member can view. Returns members sorted by role
   * (owner first, then admin, then member), then by name
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
  );

export default membersRoutes;
