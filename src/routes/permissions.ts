import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import validateApiKey from "lib/auth/apiKey";
import { dbPool as db } from "lib/db/db";
import {
  userOrganizationTable,
  userTable,
  workflowPermissionTable,
  workflowTable,
} from "lib/db/schema";
import logger from "lib/logger";

/**
 * Per-workflow permission management endpoints.
 *
 * Allows admins and owners to grant/revoke viewer or editor
 * permissions on individual workflows to specific users.
 */
const permissionsRoutes = new Elysia({
  prefix: "/workflows/:workflowId/permissions",
})
  /**
   * List permissions for a workflow.
   * GET /api/v1/workflows/:workflowId/permissions
   */
  .get(
    "/",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;

      // Verify workflow belongs to this org
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, params.workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
        columns: { id: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      const permissions = await db
        .select({
          id: workflowPermissionTable.id,
          userId: workflowPermissionTable.userId,
          permission: workflowPermissionTable.permission,
          createdAt: workflowPermissionTable.createdAt,
          userName: userTable.name,
          userEmail: userTable.email,
          userAvatarUrl: userTable.avatarUrl,
        })
        .from(workflowPermissionTable)
        .innerJoin(userTable, eq(workflowPermissionTable.userId, userTable.id))
        .where(eq(workflowPermissionTable.workflowId, params.workflowId));

      return { permissions };
    },
    {
      params: t.Object({ workflowId: t.String() }),
    },
  )

  /**
   * Grant a permission on a workflow.
   * POST /api/v1/workflows/:workflowId/permissions
   *
   * Admin+ only. Upserts (updates if exists).
   */
  .post(
    "/",
    async ({ params, body, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId, userId: idpUserId } = apiKeyInfo;

      // Verify workflow belongs to this org
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, params.workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
        columns: { id: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      // Resolve caller and verify admin+
      const callerUser = idpUserId
        ? await db.query.userTable.findFirst({
            where: eq(userTable.identityProviderId, idpUserId),
            columns: { id: true },
          })
        : null;

      if (!callerUser) {
        return status(403, { error: "Access denied" });
      }

      const callerMembership = await db.query.userOrganizationTable.findFirst({
        where: and(
          eq(userOrganizationTable.userId, callerUser.id),
          eq(userOrganizationTable.organizationId, organizationId),
        ),
        columns: { role: true },
      });

      if (!callerMembership || callerMembership.role === "member") {
        return status(403, {
          error: "Only admins and owners can manage workflow permissions",
        });
      }

      // Verify target user exists and is in the org
      const targetMembership = await db.query.userOrganizationTable.findFirst({
        where: and(
          eq(userOrganizationTable.userId, body.userId),
          eq(userOrganizationTable.organizationId, organizationId),
        ),
      });

      if (!targetMembership) {
        return status(400, {
          error: "User is not a member of this organization",
        });
      }

      // Upsert permission
      const [result] = await db
        .insert(workflowPermissionTable)
        .values({
          workflowId: params.workflowId,
          userId: body.userId,
          permission: body.permission,
          grantedBy: callerUser.id,
        })
        .onConflictDoUpdate({
          target: [
            workflowPermissionTable.workflowId,
            workflowPermissionTable.userId,
          ],
          set: {
            permission: body.permission,
            grantedBy: callerUser.id,
          },
        })
        .returning();

      logger.info("Workflow permission granted", {
        workflowId: params.workflowId,
        userId: body.userId,
        permission: body.permission,
      });

      return { permission: result };
    },
    {
      params: t.Object({ workflowId: t.String() }),
      body: t.Object({
        userId: t.String(),
        permission: t.Union([t.Literal("viewer"), t.Literal("editor")]),
      }),
    },
  )

  /**
   * Revoke a permission from a workflow.
   * DELETE /api/v1/workflows/:workflowId/permissions/:userId
   *
   * Admin+ only.
   */
  .delete(
    "/:userId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId, userId: idpUserId } = apiKeyInfo;

      // Verify workflow belongs to this org
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, params.workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
        columns: { id: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      // Resolve caller and verify admin+
      const callerUser = idpUserId
        ? await db.query.userTable.findFirst({
            where: eq(userTable.identityProviderId, idpUserId),
            columns: { id: true },
          })
        : null;

      if (!callerUser) {
        return status(403, { error: "Access denied" });
      }

      const callerMembership = await db.query.userOrganizationTable.findFirst({
        where: and(
          eq(userOrganizationTable.userId, callerUser.id),
          eq(userOrganizationTable.organizationId, organizationId),
        ),
        columns: { role: true },
      });

      if (!callerMembership || callerMembership.role === "member") {
        return status(403, {
          error: "Only admins and owners can manage workflow permissions",
        });
      }

      const deleted = await db
        .delete(workflowPermissionTable)
        .where(
          and(
            eq(workflowPermissionTable.workflowId, params.workflowId),
            eq(workflowPermissionTable.userId, params.userId),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        return status(404, { error: "Permission not found" });
      }

      logger.info("Workflow permission revoked", {
        workflowId: params.workflowId,
        userId: params.userId,
      });

      return { success: true };
    },
    {
      params: t.Object({
        workflowId: t.String(),
        userId: t.String(),
      }),
    },
  );

export default permissionsRoutes;
