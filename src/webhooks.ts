import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { recordUsage } from "lib/billing";
import {
  AUDIT_WEBHOOK_SECRET,
  AUTHZ_WEBHOOK_SECRET,
  EMAIL_WEBHOOK_SECRET,
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET,
} from "lib/config/env.config";
import { generateRequestId } from "lib/context";
import secretsMatch from "lib/crypto/secretsMatch";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable } from "lib/db/schema";
import { dispatchWorkflow } from "lib/dispatch";
import { entitlementsWebhook } from "lib/entitlements";
import { isExecutionAllowed } from "lib/entitlements/enforce";
import { isConfigured, pushEvent } from "lib/hatchet/client";
import { idpWebhook } from "lib/idp";
import logger from "lib/logger";

/**
 * Best-effort publish to Iggy so webhook events are available for replay/audit
 * even when the streaming layer is temporarily unavailable.
 */
async function publishEventBestEffort(params: {
  type: string;
  source: string;
  organizationId: string;
  data: Record<string, unknown>;
  subject?: string;
}): Promise<void> {
  try {
    const { eventsClient } = await import("server");
    if (!eventsClient) return;

    await eventsClient.publish(params);
  } catch (err) {
    logger.warn("Failed to persist webhook event to Iggy", {
      type: params.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Shared workflow webhook trigger handler.
 *
 * `secret` arrives either in the `x-webhook-secret` header (preferred) or in
 * the URL path (deprecated). The path form puts the secret in a URL, so it is
 * recorded by every access log between the caller and here (Cloudflare, the
 * gateway, browser history, `Referer`). Callers should send the header; the
 * path form stays until they have all migrated.
 */
const handleWorkflowWebhook = async ({
  workflowId,
  secret,
  body,
  status,
}: {
  workflowId: string;
  secret: string | undefined;
  body: unknown;
  // biome-ignore lint/suspicious/noExplicitAny: Elysia's status helper
  status: any;
}) => {
  {
    // Fetch workflow and verify secret
    const workflow = await db.query.workflowTable.findFirst({
      where: eq(workflowTable.id, workflowId),
    });

    if (!workflow) {
      return status(404, { error: "Workflow not found" });
    }

    // Verify webhook secret using timing-safe comparison
    if (
      !secret ||
      !workflow.webhookSecret ||
      !secretsMatch(workflow.webhookSecret, secret)
    ) {
      return status(401, { error: "Invalid webhook secret" });
    }

    // Check if workflow is active
    if (!workflow.isActive) {
      return status(400, { error: "Workflow is disabled" });
    }

    if (!(await isExecutionAllowed(workflow.organizationId))) {
      void recordUsage(
        "organization",
        workflow.organizationId,
        "rejected_executions",
        1,
      );
      return status(429, { error: "Monthly execution limit reached" });
    }

    let runId: string | undefined;

    try {
      // Generate run IDs
      const engineWorkflowId = `webhook-${workflowId}-${Date.now()}`;
      const engineRunId = `run-${Date.now()}-${crypto.randomUUID()}`;

      // Create run record
      const [run] = await db
        .insert(workflowRunTable)
        .values({
          workflowId,
          engineWorkflowId,
          engineRunId,
          status: "pending",
          input: (body as Record<string, unknown>) || {},
        })
        .returning();

      runId = run.id;

      await publishEventBestEffort({
        type: "workflow.webhook.received",
        source: "webhook",
        organizationId: workflow.organizationId,
        subject: workflowId,
        data: {
          workflowId,
          runId: run.id,
          body: (body as Record<string, unknown>) || {},
        },
      });

      // Trigger execution via dispatch helper
      await dispatchWorkflow(workflow, run, {
        ...((body as Record<string, unknown>) || {}),
        _requestId: generateRequestId(),
      });

      // Update status to running (only if still pending to avoid overwriting terminal status)
      await db
        .update(workflowRunTable)
        .set({ status: "running" })
        .where(
          and(
            eq(workflowRunTable.id, run.id),
            eq(workflowRunTable.status, "pending"),
          ),
        );

      // Record usage to Aether (fire-and-forget)
      void recordUsage(
        "organization",
        workflow.organizationId,
        "workflow_executions",
        1,
        `run-${run.id}`,
      );

      return {
        success: true,
        runId: run.id,
        message: "Workflow triggered successfully",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      logger.error("Workflow webhook trigger failed", {
        error: message,
      });

      if (runId) {
        await db
          .update(workflowRunTable)
          .set({
            status: "failed",
            error: message,
            completedAt: new Date().toISOString(),
          })
          .where(eq(workflowRunTable.id, runId))
          .catch((dbErr) => {
            logger.error("Failed to mark run as failed", {
              runId,
              error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            });
          });
      }

      return status(500, { error: "Failed to trigger workflow" });
    }
  }
};

/**
 * Workflow webhook trigger routes.
 */
const workflowWebhook = new Elysia()
  // Preferred: secret in a header, so it never reaches a URL or an access log
  .post(
    "/workflow/:workflowId",
    ({ params, body, headers, status }) =>
      handleWorkflowWebhook({
        workflowId: params.workflowId,
        secret: headers["x-webhook-secret"],
        body,
        status,
      }),
    {
      params: t.Object({
        workflowId: t.String(),
      }),
      headers: t.Object({
        "x-webhook-secret": t.Optional(t.String()),
      }),
    },
  )
  // Deprecated: secret in the path. Kept until every caller sends the header.
  .post(
    "/workflow/:workflowId/:secret",
    ({ params, body, status }) =>
      handleWorkflowWebhook({
        workflowId: params.workflowId,
        secret: params.secret,
        body,
        status,
      }),
    {
      params: t.Object({
        workflowId: t.String(),
        secret: t.String(),
      }),
    },
  );

/**
 * AuthZ sync webhook handler.
 *
 * Receives tuple sync events from Gatekeeper (IDP), Backfeed, Runa, and other apps.
 * Triggers the authz-sync workflow for durable delivery to Warden PDP.
 */
/**
 * Shared handler for both the header and legacy path forms of the webhook.
 *
 * `secret` arrives either in the `x-webhook-secret` header (preferred) or in
 * the URL path (deprecated). The path form puts the secret in a URL, so it is
 * recorded by every access log between the caller and here (Cloudflare, the
 * gateway, and this service's own error log on a miss). Callers should send the
 * header; the path form stays until they have all migrated.
 */
const handleAuthzWebhook = async ({
  secret,
  body,
  headers,
  status,
}: {
  secret: string | undefined;
  body: unknown;
  headers: Record<string, string | undefined>;
  // biome-ignore lint/suspicious/noExplicitAny: Elysia's status helper
  status: any;
}) => {
  {
    // Verify secret matches configured AUTHZ_WEBHOOK_SECRET
    if (!AUTHZ_WEBHOOK_SECRET) {
      logger.warn("AUTHZ_WEBHOOK_SECRET not configured");
      return status(503, { error: "AuthZ webhook not configured" });
    }

    if (!secret || !secretsMatch(secret, AUTHZ_WEBHOOK_SECRET)) {
      return status(401, { error: "Invalid webhook secret" });
    }

    if (!isConfigured()) {
      return status(503, { error: "Workflow execution not configured" });
    }

    const eventType = headers["x-event-type"] as string;
    if (!eventType?.startsWith("authz.tuples.")) {
      return status(400, {
        error:
          "Invalid event type. Expected authz.tuples.write or authz.tuples.delete",
      });
    }

    const payload = body as { tuples?: unknown[]; source?: string };
    if (!payload.tuples || !Array.isArray(payload.tuples)) {
      return status(400, { error: "Missing or invalid tuples array" });
    }

    try {
      await publishEventBestEffort({
        type: "authz.sync",
        source: "authz",
        organizationId: "system",
        data: {
          eventType,
          tuples: payload.tuples,
          source: payload.source || "unknown",
        },
      });

      // Trigger authz sync workflow via Hatchet event
      await pushEvent("authz:sync", {
        eventType,
        tuples: payload.tuples,
        source: payload.source || "unknown",
        timestamp: new Date().toISOString(),
      });

      logger.info("AuthZ webhook received", {
        eventType,
        tupleCount: payload.tuples.length,
        source: payload.source || "unknown",
      });

      return {
        success: true,
        message: "AuthZ sync triggered",
        tupleCount: payload.tuples.length,
      };
    } catch (err) {
      logger.error("AuthZ webhook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return status(500, { error: "Failed to trigger authz sync" });
    }
  }
};

const authzWebhook = new Elysia()
  // Preferred: secret in a header, so it never reaches a URL or an access log
  .post(
    "/authz",
    ({ body, headers, status }) =>
      handleAuthzWebhook({
        secret: headers["x-webhook-secret"],
        body,
        headers,
        status,
      }),
    {
      headers: t.Object({
        "x-event-type": t.String(),
        "x-webhook-secret": t.Optional(t.String()),
      }),
    },
  )
  // Deprecated: secret in the path. Kept until every caller sends the header.
  .post(
    "/authz/:secret",
    ({ params, body, headers, status }) =>
      handleAuthzWebhook({ secret: params.secret, body, headers, status }),
    {
      params: t.Object({
        secret: t.String(),
      }),
      headers: t.Object({
        "x-event-type": t.String(),
      }),
    },
  );

/**
 * Search bootstrap webhook handler.
 *
 * Initializes Meilisearch with search-only API key and product indexes.
 * Idempotent - safe to call multiple times.
 *
 * @example
 * ```bash
 * curl -X POST https://api.vortex.omni.dev/webhooks/search/bootstrap/$SECRET
 * ```
 */
const searchBootstrapWebhook = new Elysia().post(
  "/search/bootstrap/:secret",
  async ({ params, status }) => {
    const { secret } = params;

    if (!SEARCH_BOOTSTRAP_WEBHOOK_SECRET) {
      logger.warn("SEARCH_BOOTSTRAP_WEBHOOK_SECRET not configured");
      return status(503, { error: "Search bootstrap webhook not configured" });
    }

    if (!secretsMatch(secret, SEARCH_BOOTSTRAP_WEBHOOK_SECRET)) {
      return status(401, { error: "Invalid webhook secret" });
    }

    if (!isConfigured()) {
      return status(503, { error: "Workflow execution not configured" });
    }

    try {
      await publishEventBestEffort({
        type: "search.bootstrap",
        source: "search",
        organizationId: "system",
        data: {},
      });

      await pushEvent("search:bootstrap", {
        timestamp: new Date().toISOString(),
        source: "webhook",
      });

      logger.info("Search bootstrap triggered");

      return {
        success: true,
        message: "Search bootstrap triggered",
      };
    } catch (err) {
      logger.error("Search bootstrap webhook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return status(500, { error: "Failed to trigger search bootstrap" });
    }
  },
  {
    params: t.Object({
      secret: t.String(),
    }),
  },
);

/**
 * Audit log webhook handler.
 *
 * Receives audit events from Runa, Backfeed, Gatekeeper, and other apps.
 * Triggers the chronicle-audit workflow for durable delivery to Chronicle.
 */
const auditWebhook = new Elysia().post(
  "/audit/:secret",
  async ({ params, body, status }) => {
    const { secret } = params;

    if (!AUDIT_WEBHOOK_SECRET) {
      logger.warn("AUDIT_WEBHOOK_SECRET not configured");
      return status(503, { error: "Audit webhook not configured" });
    }

    if (!secretsMatch(secret, AUDIT_WEBHOOK_SECRET)) {
      return status(401, { error: "Invalid webhook secret" });
    }

    if (!isConfigured()) {
      return status(503, { error: "Workflow execution not configured" });
    }

    const payload = body as { events?: unknown[] };
    if (!payload.events || !Array.isArray(payload.events)) {
      return status(400, { error: "Missing or invalid events array" });
    }

    try {
      const action = (body as Record<string, unknown>).action as
        | string
        | undefined;

      await publishEventBestEffort({
        type: `audit.${action || "event"}`,
        source: "audit",
        organizationId: "system",
        data: { events: payload.events },
      });

      // Trigger chronicle audit workflow via Hatchet event
      await pushEvent("audit:log", {
        events: payload.events,
      });

      logger.info("Audit webhook received", {
        eventCount: payload.events.length,
      });

      return {
        success: true,
        message: "Audit events queued",
        eventCount: payload.events.length,
      };
    } catch (err) {
      logger.error("Audit webhook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return status(500, { error: "Failed to queue audit events" });
    }
  },
  {
    params: t.Object({
      secret: t.String(),
    }),
  },
);

/**
 * S3 event notification webhook handler.
 *
 * Receives S3 event notifications and triggers matching workflows.
 * Configure S3 bucket to send notifications to: POST /webhooks/s3/:secret
 */
const s3Webhook = new Elysia().post(
  "/s3/:secret",
  async ({ params, body, status }) => {
    const { secret } = params;

    // S3 events can come as SNS notifications or direct S3 events
    const payload = body as {
      Records?: Array<{
        eventSource?: string;
        eventName?: string;
        s3?: {
          bucket?: { name?: string };
          object?: { key?: string; size?: number };
        };
      }>;
    };

    if (!payload.Records || !Array.isArray(payload.Records)) {
      return status(400, { error: "Missing or invalid Records array" });
    }

    try {
      await publishEventBestEffort({
        type: "s3.notification",
        source: "s3",
        organizationId: "system",
        data: { records: payload.Records },
      });

      // Find workflows with matching secret
      const workflows = await db.query.workflowTable.findMany({
        where: and(
          eq(workflowTable.isActive, true),
          eq(workflowTable.webhookSecret, secret),
        ),
        columns: {
          id: true,
          organizationId: true,
          definition: true,
          executor: true,
          webhookSecret: true,
        },
      });

      // Verify each workflow's secret with timing-safe comparison
      const verifiedWorkflows = workflows.filter((w) =>
        secretsMatch(w.webhookSecret!, secret),
      );

      const matchingWorkflows = verifiedWorkflows.filter((w) => {
        const def = w.definition as {
          steps?: Array<{
            type: string;
            trigger?: { type: string; config: Record<string, unknown> };
          }>;
        };
        const triggerStep = def?.steps?.find((s) => s.type === "trigger");
        return triggerStep?.trigger?.type === "s3";
      });

      let triggeredCount = 0;

      for (const workflow of matchingWorkflows) {
        if (!(await isExecutionAllowed(workflow.organizationId))) {
          void recordUsage(
            "organization",
            workflow.organizationId,
            "rejected_executions",
            1,
          );
          continue;
        }

        for (const record of payload.Records) {
          let runId: string | undefined;

          try {
            const engineWorkflowId = `s3-${workflow.id}-${Date.now()}`;

            const [run] = await db
              .insert(workflowRunTable)
              .values({
                workflowId: workflow.id,
                engineWorkflowId,
                engineRunId: `run-${Date.now()}-${crypto.randomUUID()}`,
                status: "pending",
                input: {
                  trigger: "s3",
                  bucket: record.s3?.bucket?.name,
                  key: record.s3?.object?.key,
                  eventName: record.eventName,
                  record,
                },
              })
              .returning();

            runId = run.id;

            await dispatchWorkflow(
              workflow as Parameters<typeof dispatchWorkflow>[0],
              run,
              {
                trigger: "s3",
                bucket: record.s3?.bucket?.name,
                key: record.s3?.object?.key,
                eventName: record.eventName,
                record,
                _requestId: generateRequestId(),
              },
            );

            // Update status to running (only if still pending to avoid overwriting terminal status)
            await db
              .update(workflowRunTable)
              .set({ status: "running" })
              .where(
                and(
                  eq(workflowRunTable.id, run.id),
                  eq(workflowRunTable.status, "pending"),
                ),
              );

            // Record usage to Aether (fire-and-forget)
            void recordUsage(
              "organization",
              workflow.organizationId,
              "workflow_executions",
              1,
              `run-${run.id}`,
            );

            triggeredCount++;
          } catch (recordErr) {
            const message =
              recordErr instanceof Error
                ? recordErr.message
                : String(recordErr);

            logger.error("S3 webhook dispatch failed for record", {
              workflowId: workflow.id,
              error: message,
            });

            if (runId) {
              await db
                .update(workflowRunTable)
                .set({
                  status: "failed",
                  error: message,
                  completedAt: new Date().toISOString(),
                })
                .where(eq(workflowRunTable.id, runId))
                .catch((dbErr) => {
                  logger.error("Failed to mark run as failed", {
                    runId,
                    error:
                      dbErr instanceof Error ? dbErr.message : String(dbErr),
                  });
                });
            }
          }
        }
      }

      return {
        success: true,
        message: "S3 events processed",
        triggeredCount,
      };
    } catch (err) {
      logger.error("S3 webhook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return status(500, { error: "Failed to process S3 events" });
    }
  },
  {
    params: t.Object({
      secret: t.String(),
    }),
  },
);

/**
 * CDC (Change Data Capture) webhook handler.
 *
 * Receives Debezium-formatted CDC events and triggers matching workflows.
 * Configure Debezium to send events to: POST /webhooks/cdc/:secret
 */
const cdcWebhook = new Elysia().post(
  "/cdc/:secret",
  async ({ params, body, status }) => {
    const { secret } = params;

    const payload = body as {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      source?: {
        table?: string;
        schema?: string;
        db?: string;
      };
      op?: string; // c=create, u=update, d=delete, r=read
    };

    // Map Debezium operation codes to standard names
    const opMap: Record<string, string> = {
      c: "INSERT",
      u: "UPDATE",
      d: "DELETE",
      r: "READ",
    };

    const operation = opMap[payload.op ?? ""] ?? "UNKNOWN";
    const table = payload.source?.table ?? "unknown";
    const schema = payload.source?.schema ?? "public";
    const fullTable = `${schema}.${table}`;

    try {
      await publishEventBestEffort({
        type: "cdc.change",
        source: "cdc",
        organizationId: "system",
        data: {
          table: fullTable,
          operation,
          before: payload.before ?? null,
          after: payload.after ?? null,
        },
      });

      // Find workflows with CDC trigger matching this secret and table
      const workflows = await db.query.workflowTable.findMany({
        where: and(
          eq(workflowTable.isActive, true),
          eq(workflowTable.webhookSecret, secret),
        ),
        columns: {
          id: true,
          organizationId: true,
          definition: true,
          executor: true,
          webhookSecret: true,
        },
      });

      // Verify each workflow's secret with timing-safe comparison
      const verifiedWorkflows = workflows.filter((w) =>
        secretsMatch(w.webhookSecret!, secret),
      );

      const matchingWorkflows = verifiedWorkflows.filter((w) => {
        const def = w.definition as {
          steps?: Array<{
            type: string;
            trigger?: { type: string; config: Record<string, unknown> };
          }>;
        };
        const triggerStep = def?.steps?.find((s) => s.type === "trigger");
        if (triggerStep?.trigger?.type !== "cdc") return false;

        const cdcConfig = triggerStep.trigger.config;
        const configTable = cdcConfig.table as string;
        const operations = (cdcConfig.operations as string[]) || [];

        // Match table name (support both schema.table and just table)
        const tableMatches = configTable === fullTable || configTable === table;

        // Match operation
        const opMatches =
          operations.length === 0 || operations.includes(operation);

        return tableMatches && opMatches;
      });

      let triggeredCount = 0;

      for (const workflow of matchingWorkflows) {
        if (!(await isExecutionAllowed(workflow.organizationId))) {
          void recordUsage(
            "organization",
            workflow.organizationId,
            "rejected_executions",
            1,
          );
          continue;
        }

        let runId: string | undefined;

        try {
          const engineWorkflowId = `cdc-${workflow.id}-${Date.now()}`;

          const [run] = await db
            .insert(workflowRunTable)
            .values({
              workflowId: workflow.id,
              engineWorkflowId,
              engineRunId: `run-${Date.now()}-${crypto.randomUUID()}`,
              status: "pending",
              input: {
                trigger: "cdc",
                table: fullTable,
                operation,
                before: payload.before,
                after: payload.after,
                source: payload.source,
              },
            })
            .returning();

          runId = run.id;

          await dispatchWorkflow(
            workflow as Parameters<typeof dispatchWorkflow>[0],
            run,
            {
              trigger: "cdc",
              table: fullTable,
              operation,
              before: payload.before,
              after: payload.after,
              source: payload.source,
              _requestId: generateRequestId(),
            },
          );

          // Update status to running (only if still pending to avoid overwriting terminal status)
          await db
            .update(workflowRunTable)
            .set({ status: "running" })
            .where(
              and(
                eq(workflowRunTable.id, run.id),
                eq(workflowRunTable.status, "pending"),
              ),
            );

          // Record usage to Aether (fire-and-forget)
          void recordUsage(
            "organization",
            workflow.organizationId,
            "workflow_executions",
            1,
            `run-${run.id}`,
          );

          triggeredCount++;
        } catch (dispatchErr) {
          const message =
            dispatchErr instanceof Error
              ? dispatchErr.message
              : String(dispatchErr);

          logger.error("CDC webhook dispatch failed", {
            workflowId: workflow.id,
            error: message,
          });

          if (runId) {
            await db
              .update(workflowRunTable)
              .set({
                status: "failed",
                error: message,
                completedAt: new Date().toISOString(),
              })
              .where(eq(workflowRunTable.id, runId))
              .catch((dbErr) => {
                logger.error("Failed to mark run as failed", {
                  runId,
                  error: dbErr instanceof Error ? dbErr.message : String(dbErr),
                });
              });
          }
        }
      }

      return {
        success: true,
        message: "CDC event processed",
        triggeredCount,
        table: fullTable,
        operation,
      };
    } catch (err) {
      logger.error("CDC webhook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return status(500, { error: "Failed to process CDC event" });
    }
  },
  {
    params: t.Object({
      secret: t.String(),
    }),
  },
);

/**
 * Inbound email webhook handler.
 *
 * Receives inbound email events from Resend and triggers matching
 * workflows with `trigger.type === "email"`.
 *
 * Configure Resend to forward inbound emails to:
 * POST /webhooks/email/:secret
 */
const emailWebhook = new Elysia().post(
  "/email/:secret",
  async ({ params, body, status }) => {
    const { secret } = params;

    if (!EMAIL_WEBHOOK_SECRET) {
      logger.warn("EMAIL_WEBHOOK_SECRET not configured");
      return status(503, { error: "Email webhook not configured" });
    }

    if (!secretsMatch(secret, EMAIL_WEBHOOK_SECRET)) {
      return status(401, { error: "Invalid webhook secret" });
    }

    // Parse the Resend inbound email webhook payload
    const payload = body as {
      from?: string;
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
      attachments?: Array<{
        filename?: string;
        content_type?: string;
        size?: number;
        content?: string;
      }>;
      headers?: Record<string, string>;
      message_id?: string;
      in_reply_to?: string;
    };

    if (!payload.from || !payload.to) {
      return status(400, { error: "Missing required fields: from, to" });
    }

    // Normalize the payload into a standard email trigger format
    const emailData = {
      from: payload.from,
      to: payload.to,
      subject: payload.subject ?? "",
      textBody: payload.text ?? "",
      htmlBody: payload.html ?? "",
      attachments: (payload.attachments ?? []).map((att) => ({
        filename: att.filename ?? "unnamed",
        contentType: att.content_type ?? "application/octet-stream",
        size: att.size ?? 0,
        content: att.content,
      })),
      headers: payload.headers ?? {},
      messageId: payload.message_id ?? `msg-${Date.now()}`,
      inReplyTo: payload.in_reply_to,
    };

    try {
      await publishEventBestEffort({
        type: "email.received",
        source: "omni.vortex.email",
        organizationId: "system",
        subject: emailData.to,
        data: emailData,
      });

      // Find active workflows with email triggers matching this recipient
      const workflows = await db.query.workflowTable.findMany({
        where: eq(workflowTable.isActive, true),
        columns: {
          id: true,
          organizationId: true,
          definition: true,
          executor: true,
        },
      });

      const matchingWorkflows = workflows.filter((w) => {
        const def = w.definition as {
          steps?: Array<{
            type: string;
            trigger?: { type: string; config: Record<string, unknown> };
          }>;
        };
        const triggerStep = def?.steps?.find((s) => s.type === "trigger");
        if (triggerStep?.trigger?.type !== "email") return false;

        const config = triggerStep.trigger.config;

        // Match recipient address
        const address = config.address as string | undefined;
        if (address && address !== emailData.to) return false;

        // Apply optional sender/subject glob filters
        const filters = config.filters as
          | { from?: string; subject?: string }
          | undefined;

        if (filters?.from) {
          const fromPattern = filters.from;
          const fromRegex = new RegExp(
            `^${fromPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
            "i",
          );
          if (!fromRegex.test(emailData.from)) return false;
        }

        if (filters?.subject) {
          const subjectPattern = filters.subject;
          const subjectRegex = new RegExp(
            `^${subjectPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
            "i",
          );
          if (!subjectRegex.test(emailData.subject)) return false;
        }

        return true;
      });

      let triggeredCount = 0;

      for (const workflow of matchingWorkflows) {
        if (!(await isExecutionAllowed(workflow.organizationId))) {
          void recordUsage(
            "organization",
            workflow.organizationId,
            "rejected_executions",
            1,
          );
          continue;
        }

        let runId: string | undefined;

        try {
          const engineWorkflowId = `email-${workflow.id}-${Date.now()}`;

          const [run] = await db
            .insert(workflowRunTable)
            .values({
              workflowId: workflow.id,
              engineWorkflowId,
              engineRunId: `run-${Date.now()}-${crypto.randomUUID()}`,
              status: "pending",
              input: {
                trigger: "email",
                ...emailData,
              },
            })
            .returning();

          runId = run.id;

          await dispatchWorkflow(
            workflow as Parameters<typeof dispatchWorkflow>[0],
            run,
            {
              trigger: "email",
              ...emailData,
              _requestId: generateRequestId(),
            },
          );

          // Update status to running (only if still pending to avoid overwriting terminal status)
          await db
            .update(workflowRunTable)
            .set({ status: "running" })
            .where(
              and(
                eq(workflowRunTable.id, run.id),
                eq(workflowRunTable.status, "pending"),
              ),
            );

          // Record usage to Aether (fire-and-forget)
          void recordUsage(
            "organization",
            workflow.organizationId,
            "workflow_executions",
            1,
            `run-${run.id}`,
          );

          triggeredCount++;
        } catch (dispatchErr) {
          const message =
            dispatchErr instanceof Error
              ? dispatchErr.message
              : String(dispatchErr);

          logger.error("Email webhook dispatch failed", {
            workflowId: workflow.id,
            error: message,
          });

          if (runId) {
            await db
              .update(workflowRunTable)
              .set({
                status: "failed",
                error: message,
                completedAt: new Date().toISOString(),
              })
              .where(eq(workflowRunTable.id, runId))
              .catch((dbErr) => {
                logger.error("Failed to mark run as failed", {
                  runId,
                  error: dbErr instanceof Error ? dbErr.message : String(dbErr),
                });
              });
          }
        }
      }

      return {
        success: true,
        message: "Email event processed",
        triggeredCount,
        messageId: emailData.messageId,
      };
    } catch (err) {
      logger.error("Email webhook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return status(500, { error: "Failed to process email event" });
    }
  },
  {
    params: t.Object({
      secret: t.String(),
    }),
  },
);

/**
 * Webhooks Elysia instance.
 * @see https://hookdeck.com/webhooks/guides/what-are-webhooks-how-they-work
 */
const webhooks = new Elysia({ prefix: "/webhooks" })
  .use(workflowWebhook)
  .use(authzWebhook)
  .use(auditWebhook)
  .use(searchBootstrapWebhook)
  .use(entitlementsWebhook)
  .use(idpWebhook)
  .use(s3Webhook)
  .use(cdcWebhook)
  .use(emailWebhook);

export default webhooks;
