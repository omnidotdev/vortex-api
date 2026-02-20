/**
 * Shared workflow dispatch helper.
 *
 * Routes workflow execution to Hatchet (event-driven, default) or Temporal
 * (durable long-running) based on the workflow's `executor` field.
 */

import Hatchet from "@hatchet-dev/typescript-sdk";
import { Client, Connection } from "@temporalio/client";
import type { InferSelectModel } from "drizzle-orm";

import logger from "lib/logger";

import type { workflowRunTable, workflowTable } from "lib/db/schema";

type Workflow = InferSelectModel<typeof workflowTable>;
type WorkflowRun = Pick<
  InferSelectModel<typeof workflowRunTable>,
  "id" | "engineWorkflowId"
>;

// Initialize Hatchet client once at module load
let hatchet: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchet = Hatchet.init();
} catch {
  logger.warn("Hatchet not configured — Hatchet-backed workflows unavailable");
}

// Initialize Temporal client lazily (only if TEMPORAL_ADDRESS is set)
let temporalClient: Client | null = null;

async function getTemporalClient(): Promise<Client | null> {
  if (temporalClient) return temporalClient;
  if (!process.env.TEMPORAL_ADDRESS) return null;

  try {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS,
    });
    temporalClient = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    });
    return temporalClient;
  } catch (err) {
    logger.error("Failed to connect to Temporal", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Dispatch a workflow to the appropriate execution backend.
 *
 * Reads `workflow.executor` to route:
 * - `"hatchet"` (default) → Hatchet event push
 * - `"temporal"` → Temporal workflow start
 * @param workflow - The workflow record from the database.
 * @param run - The workflow run record containing engine identifiers.
 * @param triggerData - Arbitrary trigger payload forwarded to the executor.
 * @throws If the requested executor is not configured.
 */
export async function dispatchWorkflow(
  workflow: Workflow,
  run: WorkflowRun,
  triggerData: Record<string, unknown>,
): Promise<void> {
  const executor = workflow.executor ?? "hatchet";
  const input = {
    workflowId: run.engineWorkflowId,
    runId: run.id,
    organizationId: workflow.organizationId,
    triggerData,
    definition: workflow.definition,
  };

  if (executor === "temporal") {
    const client = await getTemporalClient();
    if (!client) {
      throw new Error(
        "Temporal executor requested but TEMPORAL_ADDRESS is not configured",
      );
    }
    await client.workflow.start("dslWorkflow", {
      taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "vortex-dsl",
      workflowId: run.id,
      args: [input],
    });
    logger.info("Dispatched to Temporal", {
      workflowId: workflow.id,
      runId: run.id,
    });
    return;
  }

  // Default: Hatchet
  if (!hatchet) {
    throw new Error(
      "Hatchet executor requested but HATCHET_CLIENT_TOKEN is not configured",
    );
  }
  await hatchet.event.push("workflow:execute", input);
  logger.info("Dispatched to Hatchet", {
    workflowId: workflow.id,
    runId: run.id,
  });
}
