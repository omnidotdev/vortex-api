import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { FEATURE_KEYS } from "lib/aether/client";
import validateApiKey from "lib/auth/apiKey";
import { getAvailableConnectors } from "lib/connectors/registry";
import { generateRequestId } from "lib/context";
import { dbPool as db } from "lib/db/db";
import {
  eventLogTable,
  eventSchemaTable,
  workflowRunTable,
  workflowStepLogTable,
  workflowTable,
} from "lib/db/schema";
import { dispatchWorkflow } from "lib/dispatch";
import { getPlanLimit } from "lib/entitlements/enforce";
import logger from "lib/logger";
import oauthRoutes from "lib/oauth/routes";
import dlqRoutes from "routes/dlq";
import functionRoutes from "routes/functions";
import internalRoutes from "routes/internal";
import marketplaceRoutes from "routes/marketplace";
import membersRoutes from "routes/members";
import permissionsRoutes from "routes/permissions";
import pluginRoutes from "routes/plugins";
import runsRoutes from "routes/runs";
import statsRoutes from "routes/stats";
import subscriptionRoutes from "routes/subscriptions";
import { versionsRoutes } from "routes/versions";
import workflowRoutes from "routes/workflows";

import type EventsClient from "lib/events";

/**
 * Resolve `eventsClient` lazily to avoid a circular import with `server.ts`.
 */
const getEventsClient = async (): Promise<EventsClient | null> => {
  const { eventsClient } = await import("server");
  return eventsClient;
};

/**
 * REST API Elysia instance.
 *
 * Provides programmatic access to workflow operations.
 */
const api = new Elysia({ prefix: "/api/v1" })
  /**
   * Trigger a workflow execution.
   * POST /api/v1/workflows/:workflowId/trigger
   */
  .post(
    "/workflows/:workflowId/trigger",
    async ({ params, body, headers, status }) => {
      const requestId = headers["x-request-id"] || generateRequestId();
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { workflowId } = params;

      // Fetch workflow and verify ownership
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      if (!workflow.isActive) {
        return status(400, { error: "Workflow is disabled" });
      }

      try {
        // Enforce monthly run limit
        const startOfMonth = new Date();
        startOfMonth.setUTCDate(1);
        startOfMonth.setUTCHours(0, 0, 0, 0);

        const [runLimit, [{ runCount }]] = await Promise.all([
          getPlanLimit(organizationId, FEATURE_KEYS.MAX_RUNS_PER_MONTH),
          db
            .select({ runCount: db.$count(workflowRunTable) })
            .from(workflowRunTable)
            .innerJoin(
              workflowTable,
              eq(workflowRunTable.workflowId, workflowTable.id),
            )
            .where(
              and(
                eq(workflowTable.organizationId, organizationId),
                gte(workflowRunTable.startedAt, startOfMonth.toISOString()),
              ),
            ),
        ]);

        if (runLimit !== -1 && runCount >= runLimit) {
          return status(429, {
            error: `Monthly run limit reached (${runCount}/${runLimit}). Upgrade your plan to continue.`,
          });
        }

        // Generate run IDs
        const engineWorkflowId = `api-${workflowId}-${Date.now()}`;
        const engineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Create run record
        const [run] = await db
          .insert(workflowRunTable)
          .values({
            workflowId,
            engineWorkflowId,
            engineRunId,
            status: "pending",
            input: (body as { data?: Record<string, unknown> })?.data || {},
          })
          .returning();

        // Trigger execution via dispatch helper
        await dispatchWorkflow(workflow, run, {
          ...((body as { data?: Record<string, unknown> })?.data || {}),
          _requestId: requestId,
        });

        // Update status to running
        await db
          .update(workflowRunTable)
          .set({ status: "running" })
          .where(eq(workflowRunTable.id, run.id));

        return {
          runId: run.id,
          status: "pending",
          message: "Workflow triggered successfully",
        };
      } catch (err) {
        logger.error("API trigger failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to trigger workflow" });
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
      body: t.Optional(
        t.Object({
          data: t.Optional(t.Record(t.String(), t.Unknown())),
        }),
      ),
    },
  )

  /**
   * Get workflow run status and output.
   * GET /api/v1/workflows/:workflowId/runs/:runId
   */
  .get(
    "/workflows/:workflowId/runs/:runId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { workflowId, runId } = params;

      // Verify workflow ownership
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      // Fetch run
      const run = await db.query.workflowRunTable.findFirst({
        where: and(
          eq(workflowRunTable.id, runId),
          eq(workflowRunTable.workflowId, workflowId),
        ),
      });

      if (!run) {
        return status(404, { error: "Run not found" });
      }

      // Fetch step logs
      const stepLogs = await db.query.workflowStepLogTable.findMany({
        where: eq(workflowStepLogTable.workflowRunId, runId),
        orderBy: [workflowStepLogTable.startedAt],
      });

      return {
        runId: run.id,
        workflowId: run.workflowId,
        status: run.status,
        input: run.input,
        output: run.output,
        error: run.error,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        steps: stepLogs.map((step) => ({
          stepId: step.stepId,
          stepName: step.stepName,
          stepType: step.stepType,
          status: step.status,
          input: step.input,
          output: step.output,
          error: step.error,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          durationMs:
            step.completedAt && step.startedAt
              ? new Date(step.completedAt).getTime() -
                new Date(step.startedAt).getTime()
              : null,
        })),
      };
    },
    {
      params: t.Object({
        workflowId: t.String(),
        runId: t.String(),
      }),
    },
  )

  /**
   * List workflow runs.
   * GET /api/v1/workflows/:workflowId/runs
   */
  .get(
    "/workflows/:workflowId/runs",
    async ({ params, query, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { workflowId } = params;
      const limit = Math.min(query.limit || 10, 100);
      const offset = query.offset || 0;

      // Verify workflow ownership
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      // Fetch runs
      const runs = await db.query.workflowRunTable.findMany({
        where: eq(workflowRunTable.workflowId, workflowId),
        orderBy: [desc(workflowRunTable.startedAt)],
        limit,
        offset,
      });

      const [{ total }] = await db
        .select({ total: count() })
        .from(workflowRunTable)
        .where(eq(workflowRunTable.workflowId, workflowId));

      return {
        runs: runs.map((run) => ({
          runId: run.id,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
        })),
        total,
        limit,
        offset,
      };
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
   * List workflows in organization.
   * GET /api/v1/workflows
   */
  .get(
    "/workflows",
    async ({ query, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const limit = Math.min(query.limit || 20, 100);
      const offset = query.offset || 0;

      const workflows = await db.query.workflowTable.findMany({
        where: eq(workflowTable.organizationId, organizationId),
        orderBy: [desc(workflowTable.updatedAt)],
        limit,
        offset,
      });

      return {
        workflows: workflows.map((wf) => ({
          id: wf.id,
          name: wf.name,
          description: wf.description,
          isActive: wf.isActive,
          lastRunAt: wf.lastRunAt,
          lastRunStatus: wf.lastRunStatus,
          createdAt: wf.createdAt,
          updatedAt: wf.updatedAt,
        })),
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    },
  )

  /**
   * Get single workflow details.
   * GET /api/v1/workflows/:workflowId
   */
  .get(
    "/workflows/:workflowId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { workflowId } = params;

      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        isActive: workflow.isActive,
        definition: workflow.definition,
        webhookSecret: workflow.webhookSecret,
        cronExpression: workflow.cronExpression,
        lastRunAt: workflow.lastRunAt,
        lastRunStatus: workflow.lastRunStatus,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      };
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    },
  )

  /**
   * Upsert a workflow by name (create or update).
   * PUT /api/v1/workflows/:name
   */
  .put(
    "/workflows/:name",
    async ({ params, body, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { name } = params;

      const existing = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.name, name),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (existing) {
        const [updated] = await db
          .update(workflowTable)
          .set({
            definition: body.definition,
            updatedAt: sql`now()`,
            ...(body.description !== undefined
              ? { description: body.description }
              : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          })
          .where(eq(workflowTable.id, existing.id))
          .returning();

        logger.info("Workflow upserted (updated)", {
          organizationId,
          workflowId: updated.id,
          name,
        });

        return {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          isActive: updated.isActive,
          definition: updated.definition,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      }

      const [created] = await db
        .insert(workflowTable)
        .values({
          organizationId,
          name,
          definition: body.definition,
          description: body.description,
          isActive: body.isActive ?? true,
        })
        .returning();

      logger.info("Workflow upserted (created)", {
        organizationId,
        workflowId: created.id,
        name,
      });

      return {
        id: created.id,
        name: created.name,
        description: created.description,
        isActive: created.isActive,
        definition: created.definition,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    },
    {
      params: t.Object({
        name: t.String(),
      }),
      body: t.Object({
        definition: t.Record(t.String(), t.Unknown()),
        description: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  /**
   * Clone an existing workflow.
   * POST /api/v1/workflows/:workflowId/clone
   *
   * Creates a new inactive copy of the specified workflow with the
   * same definition, description, and executor.
   */
  .post(
    "/workflows/:workflowId/clone",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { workflowId } = params;

      // Fetch workflow and verify ownership
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      // Insert cloned workflow
      const [created] = await db
        .insert(workflowTable)
        .values({
          organizationId,
          name: `Copy of ${workflow.name}`,
          definition: workflow.definition,
          description: workflow.description,
          executor: workflow.executor,
          isActive: false,
        })
        .returning();

      return {
        id: created.id,
        name: created.name,
        description: created.description,
        isActive: created.isActive,
        definition: created.definition,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    },
  )

  /**
   * Delete a workflow.
   * DELETE /api/v1/workflows/:workflowId
   */
  .delete(
    "/workflows/:workflowId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { workflowId } = params;

      // Verify workflow exists and belongs to org
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      await db.delete(workflowTable).where(eq(workflowTable.id, workflowId));

      return { deleted: true, id: workflowId };
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    },
  )

  /**
   * List available connectors (Activepieces pieces).
   * GET /api/v1/connectors
   *
   * Returns metadata for all available connectors including their
   * actions, triggers, and auth requirements.
   */
  .get("/connectors", async ({ headers, status }) => {
    const apiKeyInfo = await validateApiKey(headers.authorization);
    if (!apiKeyInfo) {
      return status(401, { error: "Invalid or missing API key" });
    }

    const connectors = await getAvailableConnectors();
    return { connectors };
  })

  /**
   * Get a specific connector's details.
   * GET /api/v1/connectors/:connectorId
   */
  .get(
    "/connectors/:connectorId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const connectors = await getAvailableConnectors();
      const connector = connectors.find((c) => c.id === params.connectorId);

      if (!connector) {
        return status(404, { error: "Connector not found" });
      }

      return connector;
    },
    {
      params: t.Object({
        connectorId: t.String(),
      }),
    },
  )

  /**
   * Ingest a structured event.
   * POST /api/v1/events
   */
  .post(
    "/events",
    async ({ body, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const eventsClient = await getEventsClient();

      if (!eventsClient) {
        return status(503, { error: "Events not configured" });
      }

      const { organizationId, name: apiKeyName } = apiKeyInfo;

      try {
        const event = await eventsClient.publish({
          type: body.type,
          data: body.data,
          source: body.source || apiKeyName,
          organizationId,
          subject: body.subject,
          correlationId:
            body.correlationId ||
            headers["x-request-id"] ||
            generateRequestId(),
          schemaId: body.schemaId,
          specversion: body.specversion,
          datacontenttype: body.datacontenttype,
          dataschema: body.dataschema,
          time: body.time,
          omniworkspaceid: body.omniworkspaceid,
          omnischemaversion: body.omnischemaversion,
        });

        return { eventId: event.id, timestamp: event.timestamp };
      } catch (err) {
        logger.error("Event ingestion failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to publish event" });
      }
    },
    {
      body: t.Object({
        type: t.String(),
        data: t.Record(t.String(), t.Unknown()),
        source: t.Optional(t.String()),
        subject: t.Optional(t.String()),
        correlationId: t.Optional(t.String()),
        schemaId: t.Optional(t.String()),
        // CloudEvents fields
        specversion: t.Optional(t.String()),
        datacontenttype: t.Optional(t.String()),
        dataschema: t.Optional(t.String()),
        time: t.Optional(t.String()),
        // Omni extension attributes
        omniworkspaceid: t.Optional(t.String()),
        omnischemaversion: t.Optional(t.Number()),
      }),
    },
  )

  /**
   * Replay events from the event log by re-publishing to Iggy.
   * POST /api/v1/events/replay
   */
  .post(
    "/events/replay",
    async ({ body, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const eventsClient = await getEventsClient();

      if (!eventsClient) {
        return status(503, { error: "Event streaming is not configured" });
      }

      const { type, since, until, limit = 100 } = body;

      if (since && Number.isNaN(new Date(since).getTime())) {
        return status(400, { error: "Invalid 'since' date format" });
      }

      if (until && Number.isNaN(new Date(until).getTime())) {
        return status(400, { error: "Invalid 'until' date format" });
      }

      const maxLimit = Math.min(limit, 1000);

      // Build filter conditions
      const conditions: ReturnType<typeof eq>[] = [
        eq(eventLogTable.organizationId, organizationId),
      ];
      if (type) conditions.push(eq(eventLogTable.type, type));
      if (since)
        conditions.push(
          gte(eventLogTable.recordedAt, new Date(since).toISOString()),
        );
      if (until)
        conditions.push(
          lte(eventLogTable.recordedAt, new Date(until).toISOString()),
        );

      const events = await db.query.eventLogTable.findMany({
        where: and(...conditions),
        limit: maxLimit,
        orderBy: [eventLogTable.recordedAt],
      });

      let replayed = 0;
      let failed = 0;

      for (const event of events) {
        try {
          await eventsClient.publish({
            type: event.type,
            source: event.source,
            subject: event.subject ?? undefined,
            organizationId: event.organizationId,
            data: event.data as Record<string, unknown>,
            correlationId: event.correlationId ?? undefined,
            schemaId: event.schemaId ?? undefined,
          });
          replayed++;
        } catch (err) {
          logger.warn("Failed to replay event", {
            eventId: event.id,
            error: err instanceof Error ? err.message : String(err),
          });
          failed++;
        }
      }

      return { replayed, failed, total: events.length };
    },
    {
      body: t.Object({
        type: t.Optional(t.String()),
        since: t.Optional(t.String()),
        until: t.Optional(t.String()),
        limit: t.Optional(t.Number()),
      }),
    },
  )

  /**
   * Register or update an event schema.
   * POST /api/v1/schemas
   *
   * Idempotent: if a schema with the same name+version exists, returns it.
   * Validates compatibility mode against previous version if applicable.
   */
  .post(
    "/schemas",
    async ({ body, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      try {
        // Check if this exact name+version already exists (idempotent)
        const existing = await db.query.eventSchemaTable.findFirst({
          where: and(
            eq(eventSchemaTable.name, body.name),
            eq(eventSchemaTable.version, body.version),
          ),
        });

        if (existing) {
          return { schema: existing, created: false };
        }

        // If version > 1, verify previous version exists
        let previousVersionId: string | undefined;

        if (body.version > 1) {
          const previous = await db.query.eventSchemaTable.findFirst({
            where: and(
              eq(eventSchemaTable.name, body.name),
              eq(eventSchemaTable.version, body.version - 1),
            ),
          });

          if (!previous) {
            return status(400, {
              error: `Previous version ${body.version - 1} not found for "${body.name}". Versions must be registered sequentially.`,
            });
          }

          previousVersionId = previous.id;
        }

        const [inserted] = await db
          .insert(eventSchemaTable)
          .values({
            name: body.name,
            source: body.source,
            description: body.description,
            payloadSchema: body.payloadSchema,
            enforcement: body.enforcement ?? "warn",
            version: body.version,
            compatibilityMode: body.compatibilityMode ?? "backward",
            previousVersionId: previousVersionId ?? null,
            migrationTransform: body.migrationTransform ?? null,
          })
          .returning();

        return { schema: inserted, created: true };
      } catch (err) {
        logger.error("Schema registration failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to register schema" });
      }
    },
    {
      body: t.Object({
        name: t.String(),
        source: t.String(),
        version: t.Number({ minimum: 1, default: 1 }),
        description: t.Optional(t.String()),
        payloadSchema: t.Optional(t.Record(t.String(), t.Unknown())),
        enforcement: t.Optional(
          t.Union([t.Literal("strict"), t.Literal("warn"), t.Literal("none")]),
        ),
        compatibilityMode: t.Optional(
          t.Union([
            t.Literal("backward"),
            t.Literal("forward"),
            t.Literal("full"),
            t.Literal("none"),
          ]),
        ),
        migrationTransform: t.Optional(t.String()),
      }),
    },
  )

  /**
   * List all registered event schemas.
   * GET /api/v1/schemas
   */
  .get(
    "/schemas",
    async ({ headers, query, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      try {
        const where = query.name
          ? eq(eventSchemaTable.name, query.name)
          : undefined;

        const schemas = await db.query.eventSchemaTable.findMany({
          where,
          orderBy: [
            desc(eventSchemaTable.name),
            desc(eventSchemaTable.version),
          ],
        });

        return { schemas };
      } catch (err) {
        logger.error("Schema listing failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to list schemas" });
      }
    },
    {
      query: t.Object({
        name: t.Optional(t.String()),
      }),
    },
  )

  /**
   * OAuth routes for integration authentication.
   */
  .use(oauthRoutes)

  /**
   * Plugin marketplace routes (WASM upload and management).
   */
  .use(pluginRoutes)

  /**
   * FaaS function invocation routes.
   */
  .use(functionRoutes)

  /**
   * Dead letter queue management routes.
   */
  .use(dlqRoutes)

  /**
   * Execution stats and analytics routes.
   */
  .use(statsRoutes)

  /**
   * Webhook subscription management routes.
   */
  .use(subscriptionRoutes)

  /**
   * Organization member management routes.
   */
  .use(membersRoutes)

  /**
   * Per-workflow permission management routes.
   */
  .use(permissionsRoutes)

  /**
   * Plugin marketplace (public registry) routes.
   */
  .use(marketplaceRoutes)

  /**
   * Workflow version history routes.
   */
  .use(versionsRoutes)

  /**
   * Workflow run SSE streaming routes.
   */
  .use(runsRoutes)

  /**
   * Workflow export routes (e.g., CF Workers WASM bundle).
   */
  .use(workflowRoutes)

  /**
   * Internal routes consumed by the edge worker.
   */
  .use(internalRoutes);

export default api;
