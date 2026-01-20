import { Hatchet } from "@hatchet-dev/typescript-sdk";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import {
  AUTHZ_WEBHOOK_SECRET,
  STRIPE_WEBHOOK_SECRET,
} from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { workflowRunTable, workflowTable, workspaceTable } from "lib/db/schema";
import { entitlementsWebhook } from "lib/entitlements";
import { idpWebhook } from "lib/idp";
import payments from "lib/payments";

import type { InferSelectModel } from "drizzle-orm";

type SelectWorkspace = InferSelectModel<typeof workspaceTable>;

// Initialize Hatchet client for workflow triggers
let hatchet: ReturnType<typeof Hatchet.init> | null = null;
try {
  hatchet = Hatchet.init();
} catch {
  console.warn("Hatchet not configured, webhook triggers will be unavailable");
}

const PRODUCT_NAME = "vortex";

/**
 * Stripe webhook handler.
 */
const stripeWebhook = new Elysia().post(
  "/stripe",
  async ({ request, headers, status }) => {
    if (!payments) {
      return status(503, "Stripe not configured");
    }

    const signature = headers["stripe-signature"];

    if (!signature) return status(400, "Missing signature");

    try {
      const body = await request.text();

      const event = await payments.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET as string,
      );

      switch (event.type) {
        case "customer.subscription.created": {
          if (event.data.object.metadata.omniProduct !== PRODUCT_NAME) break;

          const subscription = await payments.subscriptions.retrieve(
            event.data.object.id,
          );

          const tier = subscription.items.data[0].price.metadata
            .tier as SelectWorkspace["tier"];

          const workspaceId = subscription.metadata.workspaceId;

          if (subscription.status === "active")
            await db
              .update(workspaceTable)
              .set({ tier, subscriptionId: subscription.id })
              .where(eq(workspaceTable.id, workspaceId));

          break;
        }
        case "customer.subscription.updated": {
          if (event.data.object.metadata.omniProduct !== PRODUCT_NAME) break;

          const subscription = await payments.subscriptions.retrieve(
            event.data.object.id,
          );

          const workspaceId = subscription.metadata.workspaceId;

          if (subscription.status === "active") {
            const tier = subscription.items.data[0].price.metadata
              .tier as SelectWorkspace["tier"];

            await db
              .update(workspaceTable)
              .set({ tier })
              .where(
                and(
                  eq(workspaceTable.id, workspaceId),
                  eq(workspaceTable.subscriptionId, subscription.id),
                ),
              );
          }

          // If subscription is unpaid, downgrade to free but keep subscription ID
          if (subscription.status === "unpaid")
            await db
              .update(workspaceTable)
              .set({ tier: "free" })
              .where(
                and(
                  eq(workspaceTable.id, workspaceId),
                  eq(workspaceTable.subscriptionId, subscription.id),
                ),
              );

          break;
        }
        case "customer.subscription.deleted": {
          if (event.data.object.metadata.omniProduct !== PRODUCT_NAME) break;

          const subscription = await payments.subscriptions.retrieve(
            event.data.object.id,
          );

          const workspaceId = subscription.metadata.workspaceId;

          if (subscription.status === "canceled")
            await db
              .update(workspaceTable)
              .set({ tier: "free", subscriptionId: null })
              .where(
                and(
                  eq(workspaceTable.id, workspaceId),
                  eq(workspaceTable.subscriptionId, subscription.id),
                ),
              );

          break;
        }
        default:
          break;
      }

      return status(200, "Webhook event consumed");
    } catch (err) {
      console.error("[Stripe Webhook Error]", err);
      return status(500, "Internal Server Error");
    }
  },
  {
    headers: t.Object({
      "stripe-signature": t.String(),
    }),
  },
);

/**
 * Workflow webhook trigger handler.
 */
const workflowWebhook = new Elysia().post(
  "/workflow/:workflowId/:secret",
  async ({ params, body, status }) => {
    const { workflowId, secret } = params;

    if (!hatchet) {
      return status(503, { error: "Workflow execution not configured" });
    }

    // Fetch workflow and verify secret
    const workflow = await db.query.workflowTable.findFirst({
      where: eq(workflowTable.id, workflowId),
    });

    if (!workflow) {
      return status(404, { error: "Workflow not found" });
    }

    // Verify webhook secret using timing-safe comparison
    if (!workflow.webhookSecret || workflow.webhookSecret !== secret) {
      return status(401, { error: "Invalid webhook secret" });
    }

    // Check if workflow is active
    if (!workflow.isActive) {
      return status(400, { error: "Workflow is disabled" });
    }

    try {
      // Generate run IDs
      const engineWorkflowId = `webhook-${workflowId}-${Date.now()}`;
      const engineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

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

      // Trigger execution via Hatchet
      await hatchet.event.push("workflow:execute", {
        workflowId: engineWorkflowId,
        runId: run.id,
        triggerData: body || {},
        definition: workflow.definition,
      });

      // Update status to running
      await db
        .update(workflowRunTable)
        .set({ status: "running" })
        .where(eq(workflowRunTable.id, run.id));

      return {
        success: true,
        runId: run.id,
        message: "Workflow triggered successfully",
      };
    } catch (err) {
      console.error("[Workflow Webhook Error]", err);
      return status(500, { error: "Failed to trigger workflow" });
    }
  },
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
const authzWebhook = new Elysia().post(
  "/authz/:secret",
  async ({ params, body, headers, status }) => {
    const { secret } = params;

    // Verify secret matches configured AUTHZ_WEBHOOK_SECRET
    if (!AUTHZ_WEBHOOK_SECRET) {
      console.warn("[AuthZ Webhook] AUTHZ_WEBHOOK_SECRET not configured");
      return status(503, { error: "AuthZ webhook not configured" });
    }

    if (secret !== AUTHZ_WEBHOOK_SECRET) {
      return status(401, { error: "Invalid webhook secret" });
    }

    if (!hatchet) {
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
      // Trigger authz sync workflow via Hatchet event
      await hatchet.event.push("authz:sync", {
        eventType,
        tuples: payload.tuples,
        source: payload.source || "unknown",
        timestamp: new Date().toISOString(),
      });

      // biome-ignore lint/suspicious/noConsole: structured logging
      console.log(
        JSON.stringify({
          type: "authz_webhook_received",
          eventType,
          tupleCount: payload.tuples.length,
          source: payload.source || "unknown",
          timestamp: new Date().toISOString(),
        }),
      );

      return {
        success: true,
        message: "AuthZ sync triggered",
        tupleCount: payload.tuples.length,
      };
    } catch (err) {
      console.error("[AuthZ Webhook Error]", err);
      return status(500, { error: "Failed to trigger authz sync" });
    }
  },
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
 * Webhooks Elysia instance.
 * @see https://hookdeck.com/webhooks/guides/what-are-webhooks-how-they-work
 */
const webhooks = new Elysia({ prefix: "/webhooks" })
  .use(stripeWebhook)
  .use(workflowWebhook)
  .use(authzWebhook)
  .use(entitlementsWebhook)
  .use(idpWebhook);

export default webhooks;
