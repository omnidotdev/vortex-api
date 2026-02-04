/**
 * Polling Trigger for Workflows
 *
 * Periodically polls HTTP endpoints for workflows with triggerType=polling.
 * Uses content hashing or field-based deduplication to avoid duplicate triggers.
 */

import { Hatchet } from "@hatchet-dev/typescript-sdk";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";

// Initialize Hatchet client
let hatchet: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchet = Hatchet.init();
} catch {
  console.warn("[Polling] Hatchet not configured");
}

// Track active polling intervals per workflow
const activePollers = new Map<string, ReturnType<typeof setInterval>>();

// Dedup cache (in-memory fallback when Redis is unavailable)
const dedupCache = new Map<string, string>();

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
    case "ms": return value;
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    default: return 60_000;
  }
}

/**
 * Check if response data is new (not a duplicate)
 */
function isNewData(
  workflowId: string,
  data: unknown,
  deduplication: string,
  deduplicationField?: string,
): boolean {
  if (deduplication === "none") return true;

  if (deduplication === "field" && deduplicationField) {
    // Extract field value for dedup
    const value = String(
      (data as Record<string, unknown>)?.[deduplicationField] ?? "",
    );
    const key = `polling:dedup:${workflowId}:${value}`;

    // Check if we've seen this key
    if (dedupCache.has(key)) return false;
    dedupCache.set(key, "seen");
    return true;
  }

  // Hash the entire response
  const hash = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  const key = `polling:dedup:${workflowId}:hash`;

  // Check if hash matches last known
  const lastHash = dedupCache.get(key);
  if (lastHash === hash) return false;
  dedupCache.set(key, hash);
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
  const config = triggerStep?.trigger?.config as {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    deduplication?: string;
    deduplicationField?: string;
  } | undefined;

  if (!config?.url) return;

  try {
    const response = await fetch(config.url, {
      method: config.method || "GET",
      headers: config.headers,
      body: config.method === "POST" ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      console.error(`[Polling] HTTP ${response.status} for workflow ${workflow.id}`);
      return;
    }

    const data = await response.json();

    // Check deduplication
    const isNew = isNewData(
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
      triggerData: { trigger: "polling", data, polledAt: new Date().toISOString() },
      definition: workflow.definition,
    });

    await db
      .update(workflowRunTable)
      .set({ status: "running" })
      .where(eq(workflowRunTable.id, run.id));
  } catch (err) {
    console.error(`[Polling] Error polling workflow ${workflow.id}:`, err);
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
      const interval = (triggerStep?.trigger?.config?.interval as string) || "5m";
      const intervalMs = parseInterval(interval);

      // Start polling for this workflow
      const poller = setInterval(() => pollWorkflow(workflow), intervalMs);
      activePollers.set(workflow.id, poller);

      // Run immediately
      pollWorkflow(workflow);
    }
  } catch (err) {
    console.error("[Polling] Error scanning workflows:", err);
  }
}

/**
 * Start the polling trigger scheduler
 */
export function startPollingScheduler(): void {
  if (scanInterval) {
    console.warn("[Polling] Scheduler already running");
    return;
  }

  if (!hatchet) {
    console.warn("[Polling] Not starting: Hatchet not configured");
    return;
  }

  // biome-ignore lint/suspicious/noConsole: startup logging
  console.log("[Polling] Scheduler started");

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

  console.warn("[Polling] Scheduler stopped");
}
