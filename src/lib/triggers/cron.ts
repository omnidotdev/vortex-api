/**
 * Cron Scheduler for Workflow Triggers
 *
 * Periodically checks for workflows with cron expressions and triggers
 * them when their scheduled time arrives.
 */

import { CronExpressionParser } from "cron-parser";
import { and, eq, isNotNull } from "drizzle-orm";

import { recordUsage } from "lib/billing";
import {
  acquireWorkflowCronLock,
  isCacheConfigured,
  releaseWorkflowCronLock,
} from "lib/cache";
import { generateRequestId } from "lib/context";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";
import { dispatchWorkflow } from "lib/dispatch";
import { isExecutionAllowed } from "lib/entitlements/enforce";
import logger from "lib/logger";

const { ENABLE_CRON_SCHEDULER, NODE_ENV } = process.env;
const isProdEnv = NODE_ENV === "production";

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
  organizationId: string;
  definition: unknown;
  cronExpression: string | null;
}): Promise<void> {
  try {
    // Enforce monthly run limit
    if (!(await isExecutionAllowed(workflow.organizationId))) {
      void recordUsage(
        "organization",
        workflow.organizationId,
        "rejected_executions",
        1,
      );
      logger.warn("Cron trigger skipped: monthly execution limit reached", {
        workflowId: workflow.id,
        organizationId: workflow.organizationId,
      });
      return;
    }

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

    // Trigger execution via dispatch helper
    await dispatchWorkflow(
      workflow as Parameters<typeof dispatchWorkflow>[0],
      run,
      {
        trigger: "cron",
        scheduledAt: new Date().toISOString(),
        _requestId: generateRequestId(),
      },
    );

    // Update status to running
    await db
      .update(workflowRunTable)
      .set({ status: "running" })
      .where(eq(workflowRunTable.id, run.id));

    // Record usage to Aether (fire-and-forget)
    void recordUsage(
      "organization",
      workflow.organizationId,
      "workflow_executions",
      1,
      `run-${run.id}`,
    );

    // Update last run time on workflow
    await db
      .update(workflowTable)
      .set({
        lastRunAt: new Date().toISOString(),
        lastRunStatus: "running",
      })
      .where(eq(workflowTable.id, workflow.id));
  } catch (err) {
    logger.error("Failed to trigger workflow", {
      workflowId: workflow.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Check all cron-enabled workflows and trigger any that are due.
 *
 * Uses distributed locking to prevent duplicate triggers in multi-instance deployments.
 */
async function checkCronWorkflows(): Promise<void> {
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
        organizationId: true,
        definition: true,
        executor: true,
        cronExpression: true,
      },
    });

    for (const workflow of workflows) {
      if (
        workflow.cronExpression &&
        shouldTrigger(workflow.cronExpression, lastCheckTime, now)
      ) {
        // Acquire per-workflow lock so different instances can process different workflows
        const token = await acquireWorkflowCronLock(workflow.id);
        if (!token) continue;

        try {
          await triggerWorkflow(workflow);
        } finally {
          await releaseWorkflowCronLock(workflow.id, token);
        }
      }
    }
  } catch (err) {
    logger.error("Error checking cron workflows", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  lastCheckTime = now;
}

/**
 * Start the cron scheduler.
 *
 * In production, cache is REQUIRED for distributed locking to prevent
 * duplicate workflow triggers across multiple instances.
 */
export function startCronScheduler(): void {
  // Check if scheduler is explicitly disabled via environment variable
  if (ENABLE_CRON_SCHEDULER === "false") {
    logger.warn("Scheduler disabled via ENABLE_CRON_SCHEDULER=false");
    return;
  }

  if (schedulerInterval) {
    logger.warn("Cron scheduler already running");
    return;
  }

  // In production, require cache for distributed locking
  if (isProdEnv && !isCacheConfigured()) {
    logger.error(
      "Cache is required in production for distributed cron locking. Set CACHE_URL or disable cron with ENABLE_CRON_SCHEDULER=false",
    );
    throw new Error(
      "Cache is required for cron scheduler in production to prevent duplicate triggers",
    );
  }

  if (!isCacheConfigured()) {
    logger.warn(
      "Running without cache. Cron scheduler will work but is not safe for multi-instance deployments",
    );
  }

  logger.info("Cron scheduler started");

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
    logger.info("Cron scheduler stopped");
  }
}
