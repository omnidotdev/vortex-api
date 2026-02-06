import { createHmac, timingSafeEqual } from "node:crypto";

import { Elysia, t } from "elysia";

import { AETHER_WEBHOOK_SECRET } from "lib/config/env.config";
import logger from "lib/logger";
import { invalidateCache } from "./cache";

/**
 * Best-effort publish to Iggy so entitlement webhook events are available
 * for replay/audit even when the streaming layer is temporarily unavailable.
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

interface EntitlementWebhookPayload {
  eventType: string;
  entityType: string;
  entityId: string;
  productId: string;
  featureKey?: string;
  value?: unknown;
  version: number;
  timestamp: string;
  billingAccountId?: string;
}

/**
 * Verify HMAC-SHA256 signature from the entitlements service.
 */
const verifySignature = (
  payload: string,
  signature: string,
  secret: string,
): boolean => {
  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
};

/**
 * Entitlements webhook receiver.
 * Receives entitlement change events from the billing service (Aether).
 *
 * This handler:
 * 1. Verifies HMAC-SHA256 signature
 * 2. Invalidates local entitlements cache
 * 3. Optionally syncs billingAccountId to organization (if column exists)
 */
const entitlementsWebhook = new Elysia().post(
  "/entitlements",
  async ({ request, headers, set }) => {
    const signature = headers["x-billing-signature"];

    if (!AETHER_WEBHOOK_SECRET) {
      logger.warn(
        "AETHER_WEBHOOK_SECRET not set, skipping signature verification",
      );
    }

    try {
      const rawBody = await request.text();

      // Verify signature if secret is configured
      if (AETHER_WEBHOOK_SECRET && signature) {
        const isValid = verifySignature(
          rawBody,
          signature,
          AETHER_WEBHOOK_SECRET,
        );

        if (!isValid) {
          set.status = 401;
          return { error: "Invalid signature" };
        }
      } else if (AETHER_WEBHOOK_SECRET && !signature) {
        set.status = 401;
        return { error: "Missing signature" };
      }

      const body = JSON.parse(rawBody) as EntitlementWebhookPayload;

      await publishEventBestEffort({
        type: "entitlements.sync",
        source: "entitlements",
        organizationId:
          body.entityType === "organization" ? body.entityId : "system",
        subject: `${body.entityType}:${body.entityId}`,
        data: body as unknown as Record<string, unknown>,
      });

      // Handle events - invalidate local cache
      switch (body.eventType) {
        case "entitlement.created":
        case "entitlement.updated":
        case "entitlement.deleted":
          // Invalidate all cached entitlements for this entity
          await invalidateCache(`${body.entityType}:${body.entityId}:*`);
          await invalidateCache(`${body.entityType}:${body.entityId}`);

          // TODO: If your organization table has billingAccountId column,
          // sync it here:
          // if (body.billingAccountId && body.entityType === "organization") {
          //   await db
          //     .update(organizationTable)
          //     .set({ billingAccountId: body.billingAccountId })
          //     .where(eq(organizationTable.id, body.entityId));
          // }

          break;
        default:
          break;
      }

      set.status = 200;
      return { received: true };
    } catch (err) {
      logger.error("Error processing entitlements webhook", {
        error: err instanceof Error ? err.message : String(err),
      });
      set.status = 500;
      return { error: "Internal Server Error" };
    }
  },
  {
    headers: t.Object({
      "x-billing-signature": t.Optional(t.String()),
    }),
  },
);

export default entitlementsWebhook;
