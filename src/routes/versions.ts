import { and, count, desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { dbPool as db } from "lib/db/db";
import { userTable, workflowTable, workflowVersionTable } from "lib/db/schema";
import logger from "lib/logger";
import saveWorkflowVersion from "lib/workflows/versioning";

/**
 * Workflow version history routes.
 *
 * List versions, fetch a specific version, and revert to a previous version.
 */
const versionsRoutes = new Elysia({ prefix: "/workflows" })
  /**
   * List workflow versions (paginated).
   * GET /api/v1/workflows/:workflowId/versions
   */
  .get(
    "/:workflowId/versions",
    async ({ params, query, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;
      const { workflowId } = params;
      const limit = Math.min(query.limit || 20, 100);
      const offset = query.offset || 0;

      // Verify workflow belongs to caller's organization
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
        columns: { id: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      const [versions, [{ total }]] = await Promise.all([
        db
          .select({
            id: workflowVersionTable.id,
            version: workflowVersionTable.version,
            changeNote: workflowVersionTable.changeNote,
            createdAt: workflowVersionTable.createdAt,
            createdByName: userTable.name,
          })
          .from(workflowVersionTable)
          .leftJoin(userTable, eq(workflowVersionTable.createdBy, userTable.id))
          .where(eq(workflowVersionTable.workflowId, workflowId))
          .orderBy(desc(workflowVersionTable.version))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(workflowVersionTable)
          .where(eq(workflowVersionTable.workflowId, workflowId)),
      ]);

      return { versions, total };
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    },
  )

  /**
   * Get a specific workflow version (includes definition).
   * GET /api/v1/workflows/:workflowId/versions/:version
   */
  .get(
    "/:workflowId/versions/:version",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;
      const { workflowId } = params;
      const version = Number(params.version);

      // Verify workflow belongs to caller's organization
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
        columns: { id: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      const [versionRecord] = await db
        .select({
          id: workflowVersionTable.id,
          version: workflowVersionTable.version,
          definition: workflowVersionTable.definition,
          changeNote: workflowVersionTable.changeNote,
          createdAt: workflowVersionTable.createdAt,
          createdBy: workflowVersionTable.createdBy,
          createdByName: userTable.name,
        })
        .from(workflowVersionTable)
        .leftJoin(userTable, eq(workflowVersionTable.createdBy, userTable.id))
        .where(
          and(
            eq(workflowVersionTable.workflowId, workflowId),
            eq(workflowVersionTable.version, version),
          ),
        )
        .limit(1);

      if (!versionRecord) {
        return status(404, { error: "Version not found" });
      }

      return versionRecord;
    },
    {
      params: t.Object({
        workflowId: t.String(),
        version: t.String(),
      }),
    },
  )

  /**
   * Revert a workflow to a previous version.
   * POST /api/v1/workflows/:workflowId/revert/:version
   *
   * Non-destructive: creates a new version with the old definition
   * and updates the workflow's current definition.
   */
  .post(
    "/:workflowId/revert/:version",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;
      const { workflowId } = params;
      const targetVersion = Number(params.version);

      // Verify workflow belongs to caller's organization
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
        columns: { id: true, version: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      // Fetch the target version's definition
      const targetVersionRecord = await db.query.workflowVersionTable.findFirst(
        {
          where: and(
            eq(workflowVersionTable.workflowId, workflowId),
            eq(workflowVersionTable.version, targetVersion),
          ),
          columns: { definition: true },
        },
      );

      if (!targetVersionRecord) {
        return status(404, { error: "Version not found" });
      }

      // Update the workflow's definition and increment version
      const newVersionNumber = workflow.version + 1;

      await db
        .update(workflowTable)
        .set({
          definition: targetVersionRecord.definition,
          version: newVersionNumber,
          updatedAt: sql`now()`,
        })
        .where(eq(workflowTable.id, workflowId));

      // Save a new version snapshot
      const newVersion = await saveWorkflowVersion({
        workflowId,
        definition: targetVersionRecord.definition,
        changeNote: `Reverted to version ${targetVersion}`,
      });

      logger.info("Workflow reverted", {
        workflowId,
        targetVersion,
        newVersion: newVersion.version,
      });

      return { reverted: true, newVersion };
    },
    {
      params: t.Object({
        workflowId: t.String(),
        version: t.String(),
      }),
    },
  );

export { versionsRoutes };
