import { and, eq, inArray, lte } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { cacheClient } from "lib/cache/client";
import { INTERNAL_API_SECRET, WORKER_URL } from "lib/config/env.config";
import secretsMatch from "lib/crypto/secretsMatch";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";
import logger from "lib/logger";

/**
 * Validate the `Authorization: Bearer <secret>` header for internal endpoints.
 * Returns true when the header matches `INTERNAL_API_SECRET`.
 */
function validateInternalSecret(authorization: string | undefined): boolean {
  if (!INTERNAL_API_SECRET) {
    logger.warn("INTERNAL_API_SECRET not set — internal endpoints disabled");
    return false;
  }
  if (!authorization?.startsWith("Bearer ")) return false;
  return secretsMatch(authorization.slice(7), INTERNAL_API_SECRET);
}

/** Redis key prefix for internal state */
const STATE_PREFIX = "internal:state:";

/**
 * In-memory fallback state store for dev without Redis.
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
    async ({ params, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      let value: unknown;

      if (cacheClient) {
        const raw = await cacheClient.get(`${STATE_PREFIX}${params.key}`);
        value = raw ? JSON.parse(raw) : undefined;
      } else {
        value = stateStore.get(params.key);
      }

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
    async ({ params, body, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      if (cacheClient) {
        await cacheClient.set(
          `${STATE_PREFIX}${params.key}`,
          JSON.stringify(body.value),
        );
      } else {
        stateStore.set(params.key, body.value);
      }

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
    async ({ params, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      if (cacheClient) {
        await cacheClient.del(`${STATE_PREFIX}${params.key}`);
      } else {
        stateStore.delete(params.key);
      }

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
   * Proxy step execution to the vortex-worker.
   * POST /api/v1/internal/execute-step
   */
  .post(
    "/execute-step",
    async ({ body, headers, status }) => {
      if (!validateInternalSecret(headers.authorization)) {
        return status(401, { error: "Unauthorized" });
      }

      if (!WORKER_URL) {
        logger.error("WORKER_URL not configured, cannot proxy execute-step");
        return status(503, { error: "Worker not configured" });
      }

      try {
        const resp = await fetch(`${WORKER_URL}/execute-step`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: headers.authorization!,
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const err = await resp.text();
          logger.error("Worker execute-step failed", {
            status: resp.status,
            error: err,
          });
          return status(resp.status as 500, { error: err });
        }

        return resp.json();
      } catch (err) {
        logger.error("Worker execute-step proxy error", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(502, { error: "Worker unreachable" });
      }
    },
    {
      body: t.Object({
        stepType: t.String(),
        config: t.Unknown(),
        input: t.Unknown(),
        orgId: t.String(),
      }),
    },
  )

  /**
   * Mark stale runs (stuck in pending/running) as failed.
   * POST /api/v1/internal/cleanup-stale-runs
   */
  .post("/cleanup-stale-runs", async ({ headers, status }) => {
    if (!validateInternalSecret(headers.authorization)) {
      return status(401, { error: "Unauthorized" });
    }

    // Runs older than 30 minutes in non-terminal status are considered stale
    const STALE_THRESHOLD_MS = 30 * 60 * 1000;
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

    const staleRuns = await db
      .update(workflowRunTable)
      .set({
        status: "failed",
        completedAt: new Date().toISOString(),
      })
      .where(
        and(
          inArray(workflowRunTable.status, ["pending", "running"]),
          lte(workflowRunTable.createdAt, cutoff),
        ),
      )
      .returning({ id: workflowRunTable.id });

    if (staleRuns.length > 0) {
      logger.info("Cleaned up stale runs", {
        count: staleRuns.length,
        ids: staleRuns.map((r) => r.id),
      });
    }

    return { cleaned: staleRuns.length };
  });

export default internalRoutes;
