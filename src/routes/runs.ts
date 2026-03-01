import { and, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { createClient } from "redis";

import validateApiKey from "lib/auth/apiKey";
import { AUTH_BASE_URL, CACHE_URL } from "lib/config/env.config";
import { generateRequestId } from "lib/context";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";
import { dispatchWorkflow } from "lib/dispatch";
import logger from "lib/logger";

const OMNI_CLAIMS_ORGANIZATIONS =
  "https://manifold.omni.dev/@omni/claims/organizations";

interface OrganizationClaim {
  id: string;
  slug: string;
}

/**
 * Validate a session JWT via the Gatekeeper userinfo endpoint and return the
 * `organizationId` claim for the given organization.
 *
 * Used as a fallback when the Authorization header carries a session access
 * token (in-browser SSE) rather than a Vortex API key.
 */
async function resolveOrgFromSession(
  authHeader: string | undefined,
  organizationId: string,
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  let response: Response;
  try {
    response = await fetch(`${AUTH_BASE_URL}/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let claims: { [OMNI_CLAIMS_ORGANIZATIONS]?: OrganizationClaim[] };
  try {
    claims = (await response.json()) as {
      [OMNI_CLAIMS_ORGANIZATIONS]?: OrganizationClaim[];
    };
  } catch {
    return null;
  }

  const orgClaims = claims[OMNI_CLAIMS_ORGANIZATIONS];
  const isMember = orgClaims?.some((org) => org.id === organizationId);

  return isMember ? organizationId : null;
}

/** Terminal run statuses that close the stream */
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

/** Maximum stream duration in ms (10 minutes) */
const STREAM_TIMEOUT_MS = 10 * 60 * 1000;

/** Poll interval for run status checks in ms */
const STATUS_POLL_INTERVAL_MS = 5_000;

/**
 * Workflow run streaming routes.
 *
 * Provides real-time SSE updates for in-progress workflow runs.
 */
const runsRoutes = new Elysia({ prefix: "/runs" })
  /**
   * Stream workflow run events via SSE.
   * GET /api/v1/runs/:runId/stream
   *
   * Subscribes to Redis pub/sub for real-time events and streams them
   * to the client. Closes when the run reaches a terminal status or
   * after a 10-minute timeout.
   */
  .get(
    "/:runId/stream",
    async ({ params, headers, status }) => {
      const { runId } = params;

      // Try API key first (programmatic access)
      const apiKeyInfo = await validateApiKey(headers.authorization);

      let organizationId: string | null = apiKeyInfo?.organizationId ?? null;

      // Fall back to session JWT for in-browser SSE (workflow editor)
      if (!organizationId) {
        // Fetch the run to determine which org it belongs to
        const runForLookup = await db.query.workflowRunTable.findFirst({
          where: eq(workflowRunTable.id, runId),
          columns: { workflowId: true },
        });

        if (runForLookup?.workflowId) {
          const workflowForLookup = await db.query.workflowTable.findFirst({
            where: eq(workflowTable.id, runForLookup.workflowId),
            columns: { organizationId: true },
          });

          if (workflowForLookup?.organizationId) {
            organizationId = await resolveOrgFromSession(
              headers.authorization,
              workflowForLookup.organizationId,
            );
          }
        }
      }

      if (!organizationId) {
        return status(401, { error: "Invalid or missing credentials" });
      }

      if (!CACHE_URL) {
        return status(503, { error: "Cache not configured" });
      }

      // Fetch the run and verify org ownership via the associated workflow
      const run = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, runId),
        columns: { id: true, status: true, workflowId: true },
      });

      if (!run) {
        return status(404, { error: "Run not found" });
      }

      // For runs linked to a saved workflow, verify org ownership
      if (run.workflowId) {
        const workflow = await db.query.workflowTable.findFirst({
          where: and(
            eq(workflowTable.id, run.workflowId),
            eq(workflowTable.organizationId, organizationId),
          ),
          columns: { id: true },
        });

        if (!workflow) {
          return status(404, { error: "Run not found" });
        }
      }

      // If already in terminal state, send a single done event immediately
      if (TERMINAL_STATUSES.has(run.status)) {
        const encoder = new TextEncoder();
        const payload = encoder.encode(
          `data: ${JSON.stringify({ status: run.status, done: true })}\n\n`,
        );
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(payload);
              controller.close();
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            },
          },
        );
      }

      const channel = `vortex:pubsub:${organizationId}:run:${runId}:events`;

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          const enqueue = (data: unknown) => {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
              );
            } catch {
              // Controller already closed
            }
          };

          let closed = false;
          let subscriber: ReturnType<typeof createClient> | null = null;
          let pollTimer: ReturnType<typeof setInterval> | null = null;
          let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

          const cleanup = () => {
            if (closed) return;
            closed = true;

            if (pollTimer) {
              clearInterval(pollTimer);
              pollTimer = null;
            }

            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              timeoutTimer = null;
            }

            if (subscriber) {
              subscriber
                .quit()
                .catch((err) => {
                  logger.warn("Redis subscriber quit error", {
                    runId,
                    error: err instanceof Error ? err.message : String(err),
                  });
                })
                .finally(() => {
                  try {
                    controller.close();
                  } catch {
                    // Already closed
                  }
                });
            } else {
              try {
                controller.close();
              } catch {
                // Already closed
              }
            }
          };

          // 10-minute hard timeout
          timeoutTimer = setTimeout(() => {
            enqueue({ timeout: true });
            cleanup();
          }, STREAM_TIMEOUT_MS);

          // Poll DB every 5s to detect terminal status
          pollTimer = setInterval(async () => {
            try {
              const current = await db.query.workflowRunTable.findFirst({
                where: eq(workflowRunTable.id, runId),
                columns: { status: true },
              });

              if (current && TERMINAL_STATUSES.has(current.status)) {
                enqueue({ status: current.status, done: true });
                cleanup();
              }
            } catch (err) {
              logger.warn("Run status poll failed", {
                runId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }, STATUS_POLL_INTERVAL_MS);

          // Create a dedicated Redis subscriber connection (pub/sub requires its own connection)
          try {
            subscriber = createClient({ url: CACHE_URL as string });

            subscriber.on("error", (err) => {
              logger.warn("SSE subscriber connection error", {
                runId,
                error: err instanceof Error ? err.message : String(err),
              });
              enqueue({ error: "Stream connection lost" });
              cleanup();
            });

            await subscriber.connect();

            await subscriber.subscribe(channel, (message) => {
              if (closed) return;

              try {
                const parsed: unknown = JSON.parse(message);
                enqueue(parsed);

                // Close on terminal event types
                if (
                  parsed !== null &&
                  typeof parsed === "object" &&
                  "type" in parsed &&
                  (parsed.type === "run.completed" ||
                    parsed.type === "run.failed" ||
                    parsed.type === "run.cancelled")
                ) {
                  cleanup();
                }
              } catch (err) {
                logger.warn("Failed to parse SSE message", {
                  runId,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            });
          } catch (err) {
            logger.error("Failed to create SSE subscriber", {
              runId,
              error: err instanceof Error ? err.message : String(err),
            });
            enqueue({ error: "Failed to connect to event stream" });
            cleanup();
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    },
    {
      params: t.Object({
        runId: t.String(),
      }),
    },
  )

  /**
   * Retry a failed workflow run.
   * POST /api/v1/runs/:runId/retry
   *
   * Creates a new run with the same input as the original failed run
   * and dispatches it for execution.
   */
  .post(
    "/:runId/retry",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { runId } = params;

      // Fetch the run
      const run = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, runId),
      });

      if (!run) {
        return status(404, { error: "Run not found" });
      }

      // Verify org ownership via the associated workflow
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, run.workflowId!),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Run not found" });
      }

      if (run.status !== "failed") {
        return status(400, { error: "Only failed runs can be retried" });
      }

      // Generate IDs for the retry run
      const engineWorkflowId = `retry-${workflow.id}-${Date.now()}`;
      const engineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Insert new run record
      const [newRun] = await db
        .insert(workflowRunTable)
        .values({
          workflowId: run.workflowId,
          engineWorkflowId,
          engineRunId,
          status: "pending",
          input: run.input || {},
        })
        .returning();

      // Dispatch the workflow for execution
      await dispatchWorkflow(workflow, newRun, {
        ...((run.input as Record<string, unknown>) || {}),
        _requestId: generateRequestId(),
      });

      // Update status to running
      await db
        .update(workflowRunTable)
        .set({ status: "running" })
        .where(eq(workflowRunTable.id, newRun.id));

      return { runId: newRun.id, retriedFrom: runId };
    },
    {
      params: t.Object({
        runId: t.String(),
      }),
    },
  )

  /**
   * Cancel a running or pending workflow run.
   * POST /api/v1/runs/:runId/cancel
   *
   * Marks the run as cancelled and publishes a cancellation event
   * via Redis pub/sub for real-time listeners.
   */
  .post(
    "/:runId/cancel",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { runId } = params;

      // Fetch the run
      const run = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, runId),
      });

      if (!run) {
        return status(404, { error: "Run not found" });
      }

      // Verify org ownership via the associated workflow
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, run.workflowId!),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Run not found" });
      }

      if (run.status !== "running" && run.status !== "pending") {
        return status(400, {
          error: "Only running or pending runs can be cancelled",
        });
      }

      // Update run status to cancelled
      await db
        .update(workflowRunTable)
        .set({ status: "cancelled", completedAt: sql`now()` })
        .where(eq(workflowRunTable.id, runId));

      // Publish cancellation event via Redis for real-time listeners
      if (CACHE_URL) {
        try {
          const redis = createClient({ url: CACHE_URL as string });
          await redis.connect();
          await redis.publish(
            `vortex:pubsub:${organizationId}:run:${runId}:events`,
            JSON.stringify({ type: "run.cancelled" }),
          );
          await redis.quit();
        } catch (err) {
          logger.warn("Failed to publish cancellation event", {
            runId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { runId, status: "cancelled" };
    },
    {
      params: t.Object({
        runId: t.String(),
      }),
    },
  );

export default runsRoutes;
