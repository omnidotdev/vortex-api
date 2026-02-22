import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { INTERNAL_API_SECRET } from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { workflowTable } from "lib/db/schema";
import logger from "lib/logger";

/** Default secret used in development when `INTERNAL_API_SECRET` is not set */
const DEV_SECRET = "dev-internal-secret";

/** Resolved secret for validating internal requests */
const resolvedSecret = INTERNAL_API_SECRET ?? DEV_SECRET;

/**
 * Validate the `Authorization: Bearer <secret>` header for internal endpoints.
 * Returns true when the header matches `INTERNAL_API_SECRET`.
 */
function validateInternalSecret(authorization: string | undefined): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  return authorization.slice(7) === resolvedSecret;
}

/**
 * Ephemeral in-memory state store.
 *
 * Scoped to the current process; intentionally replaced by Redis later.
 * Keys are constructed by the caller (e.g. `{orgId}:{runId}:{stepId}`).
 */
const stateStore = new Map<string, unknown>();

/**
 * Internal API routes consumed by the vortex-edge-worker.
 *
 * All endpoints require `Authorization: Bearer <INTERNAL_API_SECRET>`.
 */
const internalRoutes = new Elysia({ prefix: "/internal" })
  /**
   * Fetch a workflow's definition.
   * GET /api/v1/internal/workflows/:workflowId
   */
  .get(
    "/workflows/:workflowId",
    async ({ params, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      const { workflowId } = params;

      const workflow = await db.query.workflowTable.findFirst({
        where: eq(workflowTable.id, workflowId),
        columns: { id: true, definition: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      return { id: workflow.id, definition: workflow.definition };
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    },
  )

  /**
   * Fetch all active workflows matching a cron expression.
   * GET /api/v1/internal/cron-workflows?cron=<expression>
   */
  .get(
    "/cron-workflows",
    async ({ query, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      const { cron } = query;

      const workflows = await db.query.workflowTable.findMany({
        where: eq(workflowTable.cronExpression, cron),
        columns: { id: true, definition: true },
      });

      return {
        workflows: workflows.map((wf) => ({
          id: wf.id,
          definition: wf.definition,
        })),
      };
    },
    {
      query: t.Object({
        cron: t.String(),
      }),
    },
  )

  /**
   * Fetch ephemeral edge-execution state by key.
   * GET /api/v1/internal/state/:key
   */
  .get(
    "/state/:key",
    ({ params, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      const value = stateStore.get(params.key);

      if (value === undefined) {
        return status(404, { error: "State key not found" });
      }

      return { key: params.key, value };
    },
    {
      params: t.Object({
        key: t.String(),
      }),
    },
  )

  /**
   * Store ephemeral edge-execution state.
   * PUT /api/v1/internal/state/:key
   */
  .put(
    "/state/:key",
    ({ params, body, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      stateStore.set(params.key, body.value);

      logger.debug("Internal state stored", { key: params.key });

      return { key: params.key, ok: true };
    },
    {
      params: t.Object({
        key: t.String(),
      }),
      body: t.Object({
        value: t.Unknown(),
      }),
    },
  )

  /**
   * Delete ephemeral edge-execution state.
   * DELETE /api/v1/internal/state/:key
   */
  .delete(
    "/state/:key",
    ({ params, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      stateStore.delete(params.key);

      logger.debug("Internal state deleted", { key: params.key });

      return { key: params.key, ok: true };
    },
    {
      params: t.Object({
        key: t.String(),
      }),
    },
  )

  /**
   * Execute a single workflow step (stub — not yet implemented).
   * POST /api/v1/internal/execute-step
   */
  .post(
    "/execute-step",
    ({ headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      return { result: null, status: "not_implemented" };
    },
    {
      body: t.Object({
        stepType: t.String(),
        config: t.Unknown(),
        input: t.Unknown(),
        orgId: t.String(),
      }),
    },
  );

export default internalRoutes;
