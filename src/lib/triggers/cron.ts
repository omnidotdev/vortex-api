/**
 * Cron Scheduler for Workflow Triggers
 *
 * Periodically checks for workflows with cron expressions and triggers
 * them when their scheduled time arrives.
 */

import Hatchet from "@hatchet-dev/typescript-sdk";
import { CronExpressionParser } from "cron-parser";
import { and, eq, isNotNull } from "drizzle-orm";

import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";
import { acquireCronLock, releaseCronLock } from "lib/redis";

const { ENABLE_CRON_SCHEDULER } = process.env;

// Initialize Hatchet client
let hatchet: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchet = Hatchet.init();
} catch {
  console.warn("Hatchet not configured, cron triggers will be unavailable");
}

// Track last check time to avoid duplicate triggers
let lastCheckTime = new Date();

// Check interval in milliseconds (1 minute)
const CHECK_INTERVAL_MS = 60 * 1000;

// Store the interval ID for cleanup
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check if a cron expression should have fired since the last check.
 */
function shouldTrigger(
  cronExpression: string,
  since: Date,
  now: Date,
): boolean {
  try {
    const expression = CronExpressionParser.parse(cronExpression, {
      currentDate: since,
    });

    // Check if there's at least one occurrence between since and now
    const next = expression.next();
    return next.toDate() <= now;
  } catch {
    return false;
  }
}

/**
 * Trigger a workflow execution.
 */
async function triggerWorkflow(workflow: {
  id: string;
  definition: unknown;
  cronExpression: string | null;
}): Promise<void> {
  if (!hatchet) {
    console.warn(
      `Cannot trigger workflow ${workflow.id}: Hatchet not configured`,
    );
    return;
  }

  try {
    // Generate run IDs
    const engineWorkflowId = `cron-${workflow.id}-${Date.now()}`;
    const engineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create run record
    const [run] = await db
      .insert(workflowRunTable)
      .values({
        workflowId: workflow.id,
        engineWorkflowId,
        engineRunId,
        status: "pending",
        input: { trigger: "cron", scheduledAt: new Date().toISOString() },
      })
      .returning();

    // Trigger execution via Hatchet
    await hatchet.event.push("workflow:execute", {
      workflowId: engineWorkflowId,
      runId: run.id,
      triggerData: { trigger: "cron", scheduledAt: new Date().toISOString() },
      definition: workflow.definition,
    });

    // Update status to running
    await db
      .update(workflowRunTable)
      .set({ status: "running" })
      .where(eq(workflowRunTable.id, run.id));

    // Update last run time on workflow
    await db
      .update(workflowTable)
      .set({
        lastRunAt: new Date().toISOString(),
        lastRunStatus: "running",
      })
      .where(eq(workflowTable.id, workflow.id));
  } catch (err) {
    console.error(`[Cron] Failed to trigger workflow ${workflow.id}:`, err);
  }
}

/**
 * Check all cron-enabled workflows and trigger any that are due.
 *
 * Uses distributed locking to prevent duplicate triggers in multi-instance deployments.
 */
async function checkCronWorkflows(): Promise<void> {
  // Acquire distributed lock (if Redis is configured)
  const hasLock = await acquireCronLock();
  if (!hasLock) {
    // Another instance is handling cron checks
    return;
  }

  const now = new Date();

  try {
    // Fetch all active workflows with cron expressions
    const workflows = await db.query.workflowTable.findMany({
      where: and(
        eq(workflowTable.isActive, true),
        isNotNull(workflowTable.cronExpression),
      ),
      columns: {
        id: true,
        definition: true,
        cronExpression: true,
      },
    });

    for (const workflow of workflows) {
      if (
        workflow.cronExpression &&
        shouldTrigger(workflow.cronExpression, lastCheckTime, now)
      ) {
        await triggerWorkflow(workflow);
      }
    }
  } catch (err) {
    console.error("[Cron] Error checking workflows:", err);
  } finally {
    // Release lock after check completes
    await releaseCronLock();
  }

  lastCheckTime = now;
}

/**
 * Start the cron scheduler.
 */
export function startCronScheduler(): void {
  // Check if scheduler is explicitly disabled via environment variable
  if (ENABLE_CRON_SCHEDULER === "false") {
    console.warn("[Cron] Scheduler disabled via ENABLE_CRON_SCHEDULER=false");
    return;
  }

  if (schedulerInterval) {
    console.warn("[Cron] Scheduler already running");
    return;
  }

  if (!hatchet) {
    console.warn("[Cron] Not starting scheduler: Hatchet not configured");
    return;
  }

  // Run immediately on start
  checkCronWorkflows();

  // Schedule periodic checks
  schedulerInterval = setInterval(checkCronWorkflows, CHECK_INTERVAL_MS);
}

/**
 * Stop the cron scheduler.
 */
export function stopCronScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.warn("[Cron] Scheduler stopped");
  }
}
