/**
 * Polling Trigger for Workflows
 *
 * Periodically polls HTTP endpoints for workflows with triggerType=polling.
 * Uses content hashing or field-based deduplication to avoid duplicate triggers.
 */

import { createHash } from "node:crypto";

import { Hatchet } from "@hatchet-dev/typescript-sdk";
import { eq } from "drizzle-orm";

import { generateRequestId } from "lib/context";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";
import logger from "lib/logger";
import { redisClient } from "lib/redis";

// Initialize Hatchet client
let hatchet: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchet = Hatchet.init();
} catch {
  logger.warn("Hatchet not configured, polling triggers will be unavailable");
}

// Track active polling intervals per workflow
const activePollers = new Map<string, ReturnType<typeof setInterval>>();

// In-memory fallback dedup cache (used when Redis is unavailable)
const memoryDedupCache = new Map<string, string>();

// Default check interval for scanning new/changed workflows (60s)
const SCAN_INTERVAL_MS = 60 * 1000;

let scanInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Parse interval string to milliseconds
 */
function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return 60_000; // Default 1 minute

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      return 60_000;
  }
}

/**
 * Get a value from the dedup cache.
 */
async function dedupGet(key: string): Promise<string | null> {
  if (redisClient) {
    return redisClient.get(key);
  }
  return memoryDedupCache.get(key) ?? null;
}

/**
 * Set a value in the dedup cache.
 */
async function dedupSet(key: string, value: string): Promise<void> {
  if (redisClient) {
    await redisClient.set(key, value);
    return;
  }
  memoryDedupCache.set(key, value);
}

/**
 * Check if a key exists in the dedup cache.
 */
async function dedupHas(key: string): Promise<boolean> {
  if (redisClient) {
    return (await redisClient.exists(key)) > 0;
  }
  return memoryDedupCache.has(key);
}

/**
 * Check if response data is new (not a duplicate)
 */
async function isNewData(
  workflowId: string,
  data: unknown,
  deduplication: string,
  deduplicationField?: string,
): Promise<boolean> {
  if (deduplication === "none") return true;

  if (deduplication === "field" && deduplicationField) {
    // Extract field value for dedup
    const value = String(
      (data as Record<string, unknown>)?.[deduplicationField] ?? "",
    );
    const key = `polling:dedup:${workflowId}:${value}`;

    // Check if we've seen this key
    if (await dedupHas(key)) return false;
    await dedupSet(key, "seen");
    return true;
  }

  // Hash the entire response
  const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  const key = `polling:dedup:${workflowId}:hash`;

  // Check if hash matches last known
  const lastHash = await dedupGet(key);
  if (lastHash === hash) return false;
  await dedupSet(key, hash);
  return true;
}

/**
 * Poll a single workflow's endpoint and trigger if new data
 */
async function pollWorkflow(workflow: {
  id: string;
  organizationId: string;
  definition: unknown;
}): Promise<void> {
  if (!hatchet) return;

  // Extract polling config from workflow definition
  const def = workflow.definition as {
    steps?: Array<{
      type: string;
      trigger?: { type: string; config: Record<string, unknown> };
    }>;
  };

  const triggerStep = def?.steps?.find((s) => s.type === "trigger");
  const config = triggerStep?.trigger?.config as
    | {
        url?: string;
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
        deduplication?: string;
        deduplicationField?: string;
      }
    | undefined;

  if (!config?.url) return;

  try {
    const response = await fetch(config.url, {
      method: config.method || "GET",
      headers: config.headers,
      body: config.method === "POST" ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      logger.error("HTTP error polling workflow", {
        workflowId: workflow.id,
        status: response.status,
      });
      return;
    }

    const data = await response.json();

    // Check deduplication
    const isNew = await isNewData(
      workflow.id,
      data,
      config.deduplication || "hash",
      config.deduplicationField,
    );

    if (!isNew) return;

    // Trigger workflow
    const engineWorkflowId = `polling-${workflow.id}-${Date.now()}`;
    const [run] = await db
      .insert(workflowRunTable)
      .values({
        workflowId: workflow.id,
        engineWorkflowId,
        engineRunId: `run-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: "pending",
        input: { trigger: "polling", data, polledAt: new Date().toISOString() },
      })
      .returning();

    await hatchet.event.push("workflow:execute", {
      workflowId: engineWorkflowId,
      runId: run.id,
      organizationId: workflow.organizationId,
      triggerData: {
        trigger: "polling",
        data,
        polledAt: new Date().toISOString(),
        _requestId: generateRequestId(),
      },
      definition: workflow.definition,
    });

    await db
      .update(workflowRunTable)
      .set({ status: "running" })
      .where(eq(workflowRunTable.id, run.id));
  } catch (err) {
    logger.error("Error polling workflow", {
      workflowId: workflow.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Scan for workflows with polling triggers and start/stop pollers
 */
async function scanPollingWorkflows(): Promise<void> {
  try {
    const workflows = await db.query.workflowTable.findMany({
      where: eq(workflowTable.isActive, true),
      columns: {
        id: true,
        organizationId: true,
        definition: true,
      },
    });

    // Find workflows with polling triggers
    const pollingWorkflows = workflows.filter((w) => {
      const def = w.definition as {
        steps?: Array<{
          type: string;
          trigger?: { type: string; config: Record<string, unknown> };
        }>;
      };
      const triggerStep = def?.steps?.find((s) => s.type === "trigger");
      return triggerStep?.trigger?.type === "polling";
    });

    const activeWorkflowIds = new Set(pollingWorkflows.map((w) => w.id));

    // Stop pollers for removed/disabled workflows
    for (const [id, interval] of activePollers) {
      if (!activeWorkflowIds.has(id)) {
        clearInterval(interval);
        activePollers.delete(id);
      }
    }

    // Start pollers for new workflows
    for (const workflow of pollingWorkflows) {
      if (activePollers.has(workflow.id)) continue;

      const def = workflow.definition as {
        steps?: Array<{
          type: string;
          trigger?: { type: string; config: Record<string, unknown> };
        }>;
      };
      const triggerStep = def?.steps?.find((s) => s.type === "trigger");
      const interval =
        (triggerStep?.trigger?.config?.interval as string) || "5m";
      const intervalMs = parseInterval(interval);

      // Start polling for this workflow
      const poller = setInterval(() => pollWorkflow(workflow), intervalMs);
      activePollers.set(workflow.id, poller);

      // Run immediately
      pollWorkflow(workflow);
    }
  } catch (err) {
    logger.error("Error scanning polling workflows", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Start the polling trigger scheduler
 */
export function startPollingScheduler(): void {
  if (scanInterval) {
    logger.warn("Polling scheduler already running");
    return;
  }

  if (!hatchet) {
    logger.warn("Not starting polling scheduler, Hatchet not configured");
    return;
  }

  logger.info("Polling scheduler started");

  // Run scan immediately
  scanPollingWorkflows();

  // Periodically scan for new/changed polling workflows
  scanInterval = setInterval(scanPollingWorkflows, SCAN_INTERVAL_MS);
}

/**
 * Stop the polling trigger scheduler
 */
export function stopPollingScheduler(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }

  // Stop all active pollers
  for (const [, interval] of activePollers) {
    clearInterval(interval);
  }
  activePollers.clear();

  logger.info("Polling scheduler stopped");
}
