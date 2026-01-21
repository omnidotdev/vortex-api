import { Hatchet } from "@hatchet-dev/typescript-sdk";
import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { dbPool as db } from "lib/db/db";
import {
  integrationTable,
  workflowRunTable,
  workflowStepLogTable,
  workflowTable,
} from "lib/db/schema";

// Initialize Hatchet client for workflow triggers
let hatchet: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchet = Hatchet.init();
} catch {
  // Hatchet not configured
}

/**
 * Validate API key and return organization ID if valid.
 */
const validateApiKey = async (
  authHeader: string | undefined,
): Promise<string | null> => {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.slice(7);

  // Look up API key in integrations table
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.type, "api_key"),
      eq(integrationTable.isEnabled, true),
    ),
  });

  if (!integration) {
    return null;
  }

  // Check if the API key matches
  const config = integration.config as { apiKey?: string };
  if (config.apiKey !== apiKey) {
    return null;
  }

  return integration.organizationId;
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
      const organizationId = await validateApiKey(headers.authorization);

      if (!organizationId) {
        return status(401, { error: "Invalid or missing API key" });
      }

      if (!hatchet) {
        return status(503, { error: "Workflow execution not configured" });
      }

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

        // Trigger execution via Hatchet
        await hatchet.event.push("workflow:execute", {
          workflowId: engineWorkflowId,
          runId: run.id,
          triggerData: (body as { data?: Record<string, unknown> })?.data || {},
          definition: workflow.definition,
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
        console.error("[API Trigger Error]", err);
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
      const organizationId = await validateApiKey(headers.authorization);

      if (!organizationId) {
        return status(401, { error: "Invalid or missing API key" });
      }

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
      const organizationId = await validateApiKey(headers.authorization);

      if (!organizationId) {
        return status(401, { error: "Invalid or missing API key" });
      }

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

      // Get total count (simplified - in production you'd want a proper count query)
      const allRuns = await db.query.workflowRunTable.findMany({
        where: eq(workflowRunTable.workflowId, workflowId),
        columns: { id: true },
      });

      return {
        runs: runs.map((run) => ({
          runId: run.id,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
        })),
        total: allRuns.length,
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
      const organizationId = await validateApiKey(headers.authorization);

      if (!organizationId) {
        return status(401, { error: "Invalid or missing API key" });
      }

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
      const organizationId = await validateApiKey(headers.authorization);

      if (!organizationId) {
        return status(401, { error: "Invalid or missing API key" });
      }

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
  );

export default api;
