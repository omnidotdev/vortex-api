/**
 * Shared workflow dispatch helper.
 *
 * Routes workflow execution to Hatchet (event-driven, default) or Temporal
 * (durable long-running) based on the workflow's `executor` field.
 *
 * For unknown executor slugs, looks up per-org config in workflow_executor_config
 * to support BYOK (Bring Your Own Key) backends.
 */

import Hatchet from "@hatchet-dev/typescript-sdk";
import { Client, Connection } from "@temporalio/client";
import { and, eq } from "drizzle-orm";

import { dbPool as db } from "lib/db/db";
import { decryptJson } from "lib/crypto/encryption";
import logger from "lib/logger";
import { workflowExecutorConfigTable } from "lib/db/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { workflowRunTable, workflowTable } from "lib/db/schema";

type Workflow = InferSelectModel<typeof workflowTable>;
type WorkflowRun = Pick<
  InferSelectModel<typeof workflowRunTable>,
  "id" | "engineWorkflowId"
>;

type TemporalConfig = {
  address: string;
  namespace?: string;
  taskQueue?: string;
};

// Initialize Hatchet client once at module load
let hatchet: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchet = Hatchet.init();
} catch {
  logger.warn("Hatchet not configured — Hatchet-backed workflows unavailable");
}

// Platform Temporal client (lazy, concurrency-safe)
let temporalClientPromise: Promise<Client | null> | null = null;

async function getPlatformTemporalClient(): Promise<Client | null> {
  if (!process.env.TEMPORAL_ADDRESS) return null;
  if (!temporalClientPromise) {
    temporalClientPromise = Connection.connect({
      address: process.env.TEMPORAL_ADDRESS,
    })
      .then(
        (connection) =>
          new Client({
            connection,
            namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
          }),
      )
      .catch((err) => {
        temporalClientPromise = null; // Allow retry on next call
        logger.error("Failed to connect to platform Temporal", {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
  }
  return temporalClientPromise;
}

// Cache of custom Temporal clients keyed by executor config ID
const customTemporalClients = new Map<string, Promise<Client | null>>();

async function getCustomTemporalClient(
  configId: string,
  temporalConfig: TemporalConfig,
): Promise<Client | null> {
  if (!customTemporalClients.has(configId)) {
    const promise = Connection.connect({ address: temporalConfig.address })
      .then(
        (connection) =>
          new Client({
            connection,
            namespace: temporalConfig.namespace ?? "default",
          }),
      )
      .catch((err) => {
        customTemporalClients.delete(configId); // Allow retry
        logger.error("Failed to connect to custom Temporal", {
          configId,
          address: temporalConfig.address,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
    customTemporalClients.set(configId, promise);
  }
  return customTemporalClients.get(configId)!;
}

/**
 * Dispatch a workflow to the appropriate execution backend.
 *
 * Reads `workflow.executor` to route:
 * - `"hatchet"` (default) → platform Hatchet
 * - `"temporal"` → platform Temporal
 * - anything else → BYOK lookup in workflow_executor_config
 * @param workflow - The workflow record from the database.
 * @param run - The workflow run record containing engine identifiers.
 * @param triggerData - Arbitrary trigger payload forwarded to the executor.
 * @throws If the requested executor is not configured or credentials are invalid.
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

  // Platform Hatchet
  if (executor === "hatchet") {
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
    return;
  }

  // Platform Temporal
  if (executor === "temporal") {
    const client = await getPlatformTemporalClient();
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
    logger.info("Dispatched to platform Temporal", {
      workflowId: workflow.id,
      runId: run.id,
    });
    return;
  }

  // BYOK: look up custom executor config
  const executorConfig = await db.query.workflowExecutorConfigTable.findFirst({
    where: and(
      eq(workflowExecutorConfigTable.organizationId, workflow.organizationId),
      eq(workflowExecutorConfigTable.slug, executor),
    ),
  });

  if (!executorConfig) {
    throw new Error(
      `Unknown executor "${executor}" for org ${workflow.organizationId} — register it in workflow_executor_config`,
    );
  }

  if (executorConfig.type === "temporal") {
    const temporalConfig = decryptJson<TemporalConfig>(executorConfig.config);
    const client = await getCustomTemporalClient(executorConfig.id, temporalConfig);
    if (!client) {
      throw new Error(
        `Failed to connect to custom Temporal cluster for executor "${executor}"`,
      );
    }
    await client.workflow.start("dslWorkflow", {
      taskQueue: temporalConfig.taskQueue ?? "vortex-dsl",
      workflowId: run.id,
      args: [input],
    });
    logger.info("Dispatched to BYOK Temporal", {
      workflowId: workflow.id,
      runId: run.id,
      executor,
    });
    return;
  }

  throw new Error(
    `Unsupported executor type "${executorConfig.type}" for executor "${executor}"`,
  );
}
