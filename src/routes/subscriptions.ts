import { and, count, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { dbPool as db } from "lib/db/db";
import {
  eventSubscriptionTable,
  subscriptionDeliveryTable,
} from "lib/db/schema";
import logger from "lib/logger";
import validateTargetUrl from "lib/validation/validateTargetUrl";

/**
 * Generate a cryptographically random HMAC secret.
 */
const generateHmacSecret = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Webhook subscription management routes.
 *
 * Create, list, update, and delete event subscriptions for HMAC-signed
 * webhook delivery. Subscriptions match events by source/type glob patterns
 * and deliver payloads to configured HTTPS endpoints.
 */
const subscriptionRoutes = new Elysia({ prefix: "/subscriptions" })
  /**
   * Create a new event subscription.
   * POST /api/v1/subscriptions
   */
  .post(
    "/",
    async ({ body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      try {
        await validateTargetUrl(body.targetUrl);
      } catch (err) {
        return status(400, {
          error: err instanceof Error ? err.message : "Invalid target URL",
        });
      }

      const hmacSecret = body.hmacSecret || generateHmacSecret();

      const [subscription] = await db
        .insert(eventSubscriptionTable)
        .values({
          organizationId,
          name: body.name,
          description: body.description,
          sourcePattern: body.sourcePattern,
          typePattern: body.typePattern,
          targetUrl: body.targetUrl,
          hmacSecret,
          signatureHeader: body.signatureHeader ?? "x-vortex-signature",
          transform: body.transform,
          payloadMode: body.payloadMode ?? "data",
          maxRetries: body.maxRetries ?? 5,
          initialBackoffMs: body.initialBackoffMs ?? 1000,
          backoffMultiplier: body.backoffMultiplier ?? 2,
        })
        .returning();

      logger.info("Subscription created", {
        subscriptionId: subscription.id,
        organizationId,
        userId: authInfo.userId,
        typePattern: body.typePattern,
        targetUrl: body.targetUrl,
      });

      // Return hmacSecret only on creation
      return {
        ...subscription,
        hmacSecret,
      };
    },
    {
      body: t.Object({
        name: t.String(),
        typePattern: t.String(),
        targetUrl: t.String(),
        description: t.Optional(t.String()),
        sourcePattern: t.Optional(t.String()),
        hmacSecret: t.Optional(t.String()),
        signatureHeader: t.Optional(t.String()),
        transform: t.Optional(t.String()),
        payloadMode: t.Optional(
          t.Union([t.Literal("data"), t.Literal("envelope")]),
        ),
        maxRetries: t.Optional(t.Number()),
        initialBackoffMs: t.Optional(t.Number()),
        backoffMultiplier: t.Optional(t.Number()),
      }),
    },
  )

  /**
   * Upsert a subscription by name (create or update).
   * PUT /api/v1/subscriptions/:name
   *
   * Preserves existing `hmacSecret` on update. Only returns
   * `hmacSecret` when a new subscription is created.
   */
  .put(
    "/:name",
    async ({ params, body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      try {
        await validateTargetUrl(body.targetUrl);
      } catch (err) {
        return status(400, {
          error: err instanceof Error ? err.message : "Invalid target URL",
        });
      }

      const [existing] = await db
        .select()
        .from(eventSubscriptionTable)
        .where(
          and(
            eq(eventSubscriptionTable.organizationId, organizationId),
            eq(eventSubscriptionTable.name, params.name),
          ),
        )
        .limit(1);

      if (existing) {
        const updates: Record<string, unknown> = {
          typePattern: body.typePattern,
          sourcePattern: body.sourcePattern,
          targetUrl: body.targetUrl,
          signatureHeader: body.signatureHeader ?? "x-vortex-signature",
          transform: body.transform,
          payloadMode: body.payloadMode ?? "data",
          maxRetries: body.maxRetries ?? 5,
          initialBackoffMs: body.initialBackoffMs ?? 1000,
          backoffMultiplier: body.backoffMultiplier ?? 2,
          enabled: body.enabled ?? true,
          updatedAt: sql`now()`,
        };

        // Update HMAC secret if explicitly provided
        if (body.hmacSecret) updates.hmacSecret = body.hmacSecret;

        const [updated] = await db
          .update(eventSubscriptionTable)
          .set(updates)
          .where(eq(eventSubscriptionTable.id, existing.id))
          .returning({
            id: eventSubscriptionTable.id,
            name: eventSubscriptionTable.name,
          });

        logger.info("Subscription upserted (updated)", {
          subscriptionId: updated.id,
          organizationId,
          userId: authInfo.userId,
          name: params.name,
        });

        return { id: updated.id, created: false };
      }

      const hmacSecret = body.hmacSecret || generateHmacSecret();

      const [created] = await db
        .insert(eventSubscriptionTable)
        .values({
          organizationId,
          name: params.name,
          description: body.description,
          sourcePattern: body.sourcePattern,
          typePattern: body.typePattern,
          targetUrl: body.targetUrl,
          hmacSecret,
          signatureHeader: body.signatureHeader ?? "x-vortex-signature",
          transform: body.transform,
          payloadMode: body.payloadMode ?? "data",
          maxRetries: body.maxRetries ?? 5,
          initialBackoffMs: body.initialBackoffMs ?? 1000,
          backoffMultiplier: body.backoffMultiplier ?? 2,
        })
        .returning({
          id: eventSubscriptionTable.id,
          name: eventSubscriptionTable.name,
        });

      logger.info("Subscription upserted (created)", {
        subscriptionId: created.id,
        organizationId,
        userId: authInfo.userId,
        name: params.name,
      });

      return { id: created.id, created: true, hmacSecret };
    },
    {
      params: t.Object({ name: t.String() }),
      body: t.Object({
        typePattern: t.String(),
        targetUrl: t.String(),
        description: t.Optional(t.String()),
        sourcePattern: t.Optional(t.String()),
        hmacSecret: t.Optional(t.String()),
        signatureHeader: t.Optional(t.String()),
        transform: t.Optional(t.String()),
        payloadMode: t.Optional(
          t.Union([t.Literal("data"), t.Literal("envelope")]),
        ),
        maxRetries: t.Optional(t.Number()),
        initialBackoffMs: t.Optional(t.Number()),
        backoffMultiplier: t.Optional(t.Number()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )

  /**
   * List event subscriptions (paginated).
   * GET /api/v1/subscriptions
   */
  .get(
    "/",
    async ({ query, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;
      const page = Number(query.page ?? 1);
      const limit = Math.min(Number(query.limit ?? 20), 100);
      const offset = (page - 1) * limit;

      const conditions = [
        eq(eventSubscriptionTable.organizationId, organizationId),
      ];

      const [subscriptions, totalResult] = await Promise.all([
        db
          .select({
            id: eventSubscriptionTable.id,
            organizationId: eventSubscriptionTable.organizationId,
            name: eventSubscriptionTable.name,
            description: eventSubscriptionTable.description,
            sourcePattern: eventSubscriptionTable.sourcePattern,
            typePattern: eventSubscriptionTable.typePattern,
            targetUrl: eventSubscriptionTable.targetUrl,
            signatureHeader: eventSubscriptionTable.signatureHeader,
            transform: eventSubscriptionTable.transform,
            payloadMode: eventSubscriptionTable.payloadMode,
            maxRetries: eventSubscriptionTable.maxRetries,
            initialBackoffMs: eventSubscriptionTable.initialBackoffMs,
            backoffMultiplier: eventSubscriptionTable.backoffMultiplier,
            enabled: eventSubscriptionTable.enabled,
            createdAt: eventSubscriptionTable.createdAt,
            updatedAt: eventSubscriptionTable.updatedAt,
          })
          .from(eventSubscriptionTable)
          .where(and(...conditions))
          .orderBy(eventSubscriptionTable.createdAt)
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(eventSubscriptionTable)
          .where(and(...conditions)),
      ]);

      return {
        nodes: subscriptions,
        total: totalResult[0]?.count ?? 0,
        page,
        limit,
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Get subscription detail.
   * GET /api/v1/subscriptions/:id
   */
  .get(
    "/:id",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      const [subscription] = await db
        .select({
          id: eventSubscriptionTable.id,
          organizationId: eventSubscriptionTable.organizationId,
          name: eventSubscriptionTable.name,
          description: eventSubscriptionTable.description,
          sourcePattern: eventSubscriptionTable.sourcePattern,
          typePattern: eventSubscriptionTable.typePattern,
          targetUrl: eventSubscriptionTable.targetUrl,
          signatureHeader: eventSubscriptionTable.signatureHeader,
          transform: eventSubscriptionTable.transform,
          payloadMode: eventSubscriptionTable.payloadMode,
          maxRetries: eventSubscriptionTable.maxRetries,
          initialBackoffMs: eventSubscriptionTable.initialBackoffMs,
          backoffMultiplier: eventSubscriptionTable.backoffMultiplier,
          enabled: eventSubscriptionTable.enabled,
          createdAt: eventSubscriptionTable.createdAt,
          updatedAt: eventSubscriptionTable.updatedAt,
        })
        .from(eventSubscriptionTable)
        .where(
          and(
            eq(eventSubscriptionTable.id, params.id),
            eq(eventSubscriptionTable.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!subscription) {
        return status(404, { error: "Subscription not found" });
      }

      return subscription;
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  /**
   * Update subscription fields.
   * PATCH /api/v1/subscriptions/:id
   */
  .patch(
    "/:id",
    async ({ params, body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify subscription exists and belongs to org
      const [existing] = await db
        .select({ id: eventSubscriptionTable.id })
        .from(eventSubscriptionTable)
        .where(
          and(
            eq(eventSubscriptionTable.id, params.id),
            eq(eventSubscriptionTable.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!existing) {
        return status(404, { error: "Subscription not found" });
      }

      if (body.targetUrl !== undefined) {
        try {
          await validateTargetUrl(body.targetUrl);
        } catch (err) {
          return status(400, {
            error: err instanceof Error ? err.message : "Invalid target URL",
          });
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined)
        updates.description = body.description;
      if (body.sourcePattern !== undefined)
        updates.sourcePattern = body.sourcePattern;
      if (body.typePattern !== undefined)
        updates.typePattern = body.typePattern;
      if (body.targetUrl !== undefined) updates.targetUrl = body.targetUrl;
      if (body.signatureHeader !== undefined)
        updates.signatureHeader = body.signatureHeader;
      if (body.transform !== undefined) updates.transform = body.transform;
      if (body.payloadMode !== undefined)
        updates.payloadMode = body.payloadMode;
      if (body.maxRetries !== undefined) updates.maxRetries = body.maxRetries;
      if (body.initialBackoffMs !== undefined)
        updates.initialBackoffMs = body.initialBackoffMs;
      if (body.backoffMultiplier !== undefined)
        updates.backoffMultiplier = body.backoffMultiplier;
      if (body.enabled !== undefined) updates.enabled = body.enabled;

      const [updated] = await db
        .update(eventSubscriptionTable)
        .set(updates)
        .where(eq(eventSubscriptionTable.id, params.id))
        .returning({
          id: eventSubscriptionTable.id,
          organizationId: eventSubscriptionTable.organizationId,
          name: eventSubscriptionTable.name,
          description: eventSubscriptionTable.description,
          sourcePattern: eventSubscriptionTable.sourcePattern,
          typePattern: eventSubscriptionTable.typePattern,
          targetUrl: eventSubscriptionTable.targetUrl,
          signatureHeader: eventSubscriptionTable.signatureHeader,
          transform: eventSubscriptionTable.transform,
          payloadMode: eventSubscriptionTable.payloadMode,
          maxRetries: eventSubscriptionTable.maxRetries,
          initialBackoffMs: eventSubscriptionTable.initialBackoffMs,
          backoffMultiplier: eventSubscriptionTable.backoffMultiplier,
          enabled: eventSubscriptionTable.enabled,
          createdAt: eventSubscriptionTable.createdAt,
          updatedAt: eventSubscriptionTable.updatedAt,
        });

      logger.info("Subscription updated", {
        subscriptionId: params.id,
        organizationId,
        userId: authInfo.userId,
        changedFields: Object.keys(body).filter(
          (k) => (body as Record<string, unknown>)[k] !== undefined,
        ),
      });

      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        sourcePattern: t.Optional(t.String()),
        typePattern: t.Optional(t.String()),
        targetUrl: t.Optional(t.String()),
        signatureHeader: t.Optional(t.String()),
        transform: t.Optional(t.String()),
        payloadMode: t.Optional(
          t.Union([t.Literal("data"), t.Literal("envelope")]),
        ),
        maxRetries: t.Optional(t.Number()),
        initialBackoffMs: t.Optional(t.Number()),
        backoffMultiplier: t.Optional(t.Number()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )

  /**
   * Delete subscription.
   * DELETE /api/v1/subscriptions/:id
   */
  .delete(
    "/:id",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      const [deleted] = await db
        .delete(eventSubscriptionTable)
        .where(
          and(
            eq(eventSubscriptionTable.id, params.id),
            eq(eventSubscriptionTable.organizationId, organizationId),
          ),
        )
        .returning({ id: eventSubscriptionTable.id });

      if (!deleted) {
        return status(404, { error: "Subscription not found" });
      }

      logger.info("Subscription deleted", {
        subscriptionId: params.id,
        organizationId,
        userId: authInfo.userId,
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  /**
   * List delivery history for a subscription (paginated).
   * GET /api/v1/subscriptions/:id/deliveries
   */
  .get(
    "/:id/deliveries",
    async ({ params, query, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify subscription belongs to org
      const [subscription] = await db
        .select({ id: eventSubscriptionTable.id })
        .from(eventSubscriptionTable)
        .where(
          and(
            eq(eventSubscriptionTable.id, params.id),
            eq(eventSubscriptionTable.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!subscription) {
        return status(404, { error: "Subscription not found" });
      }

      const page = Number(query.page ?? 1);
      const limit = Math.min(Number(query.limit ?? 20), 100);
      const offset = (page - 1) * limit;

      const conditions = [
        eq(subscriptionDeliveryTable.subscriptionId, params.id),
      ];

      if (query.status) {
        conditions.push(eq(subscriptionDeliveryTable.status, query.status));
      }

      const [deliveries, totalResult] = await Promise.all([
        db
          .select()
          .from(subscriptionDeliveryTable)
          .where(and(...conditions))
          .orderBy(subscriptionDeliveryTable.createdAt)
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(subscriptionDeliveryTable)
          .where(and(...conditions)),
      ]);

      return {
        nodes: deliveries,
        total: totalResult[0]?.count ?? 0,
        page,
        limit,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Send a test delivery to verify the subscription endpoint.
   * POST /api/v1/subscriptions/:id/test
   */
  .post(
    "/:id/test",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      const [subscription] = await db
        .select()
        .from(eventSubscriptionTable)
        .where(
          and(
            eq(eventSubscriptionTable.id, params.id),
            eq(eventSubscriptionTable.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!subscription) {
        return status(404, { error: "Subscription not found" });
      }

      const testPayload = {
        type: "vortex.subscription.test",
        source: "omni.vortex",
        data: {
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
          timestamp: new Date().toISOString(),
          message: "Test delivery from Vortex",
        },
      };

      const payload =
        subscription.payloadMode === "envelope"
          ? testPayload
          : testPayload.data;

      const payloadStr = JSON.stringify(payload);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(subscription.hmacSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(payloadStr),
      );
      const hex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      try {
        const response = await fetch(subscription.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [subscription.signatureHeader]: hex,
            "X-Vortex-Event-Type": "vortex.subscription.test",
            "X-Vortex-Delivery-Id": `test-${crypto.randomUUID()}`,
          },
          body: payloadStr,
          signal: AbortSignal.timeout(10000),
        });

        return {
          success: response.ok,
          httpStatus: response.status,
          message: response.ok
            ? "Test delivery successful"
            : `Target returned ${response.status}`,
        };
      } catch (err) {
        logger.warn("Test delivery failed", {
          subscriptionId: params.id,
          error: err instanceof Error ? err.message : String(err),
        });

        return status(502, {
          success: false,
          error: err instanceof Error ? err.message : "Delivery failed",
        });
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );

export default subscriptionRoutes;
