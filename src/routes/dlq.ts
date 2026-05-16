import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { recordUsage } from "lib/billing";
import { dbPool as db } from "lib/db/db";
import { deadLetterEventTable } from "lib/db/schema";
import { isExecutionAllowed } from "lib/entitlements/enforce";
import logger from "lib/logger";
import authorize from "lib/warden/authorize";

import type EventsClient from "lib/events";

/**
 * Resolve `eventsClient` lazily to avoid a circular import with `server.ts`
 */
const getEventsClient = async (): Promise<EventsClient | null> => {
  const { eventsClient } = await import("server");
  return eventsClient;
};

/**
 * Build common filter conditions for DLQ queries.
 *
 * Always scopes to `organizationId` and defaults to unresolved events
 * unless `includeResolved` is explicitly set.
 */
const buildConditions = ({
  organizationId,
  errorCode,
  eventType,
  since,
  includeResolved,
}: {
  organizationId: string;
  errorCode?: string;
  eventType?: string;
  since?: string;
  includeResolved?: boolean;
}) => {
  const conditions = [eq(deadLetterEventTable.organizationId, organizationId)];

  if (!includeResolved) {
    conditions.push(isNull(deadLetterEventTable.resolvedAt));
  }

  if (errorCode) {
    conditions.push(eq(deadLetterEventTable.errorCode, errorCode));
  }

  if (eventType) {
    conditions.push(eq(deadLetterEventTable.eventType, eventType));
  }

  if (since) {
    conditions.push(
      gte(deadLetterEventTable.createdAt, new Date(since).toISOString()),
    );
  }

  return conditions;
};

/**
 * Dead Letter Queue management routes.
 *
 * Inspect, replay, and discard failed events from the Postgres-backed
 * dead_letter_event table. Replay re-publishes the original event to
 * Iggy; discard sets the `resolvedAt` timestamp.
 */
const dlqRoutes = new Elysia({ prefix: "/dlq" })
  /**
   * List dead-letter events (paginated, filterable).
   * GET /api/v1/dlq
   */
  .get(
    "/",
    async ({ query, headers, status }) => {
      const authInfo = await resolveAuth(
        headers.authorization,
        headers["x-organization-id"],
      );
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (member required for DLQ read)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed)
          return status(403, { error: "Forbidden: insufficient permissions" });
      }

      const page = Number(query.page ?? 1);
      const limit = Math.min(Number(query.limit ?? 20), 100);
      const offset = (page - 1) * limit;

      if (query.since && Number.isNaN(new Date(query.since).getTime())) {
        return status(400, { error: "Invalid 'since' date format" });
      }

      const conditions = buildConditions({
        organizationId,
        errorCode: query.errorCode,
        eventType: query.eventType,
        since: query.since,
        includeResolved: query.includeResolved === "true",
      });

      const [events, totalResult] = await Promise.all([
        db
          .select()
          .from(deadLetterEventTable)
          .where(and(...conditions))
          .orderBy(deadLetterEventTable.createdAt)
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(deadLetterEventTable)
          .where(and(...conditions)),
      ]);

      return {
        nodes: events,
        total: totalResult[0]?.count ?? 0,
        page,
        limit,
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        errorCode: t.Optional(t.String()),
        eventType: t.Optional(t.String()),
        since: t.Optional(t.String()),
        includeResolved: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Aggregate DLQ stats grouped by errorCode and eventType.
   * GET /api/v1/dlq/stats
   */
  .get("/stats", async ({ headers, status }) => {
    const authInfo = await resolveAuth(
      headers.authorization,
      headers["x-organization-id"],
    );
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    // Verify Warden authorization (member required for DLQ stats)
    if (authInfo.userId) {
      const allowed = await authorize(
        authInfo.idpUserId!,
        "organization",
        organizationId,
        "member",
      );
      if (!allowed)
        return status(403, { error: "Forbidden: insufficient permissions" });
    }

    const unresolvedCondition = and(
      eq(deadLetterEventTable.organizationId, organizationId),
      isNull(deadLetterEventTable.resolvedAt),
    );

    const [totalResult, byErrorCode, byEventType] = await Promise.all([
      db
        .select({ count: count() })
        .from(deadLetterEventTable)
        .where(unresolvedCondition),
      db
        .select({
          errorCode: deadLetterEventTable.errorCode,
          count: count(),
        })
        .from(deadLetterEventTable)
        .where(unresolvedCondition)
        .groupBy(deadLetterEventTable.errorCode)
        .orderBy(sql`count(*) desc`),
      db
        .select({
          eventType: deadLetterEventTable.eventType,
          count: count(),
        })
        .from(deadLetterEventTable)
        .where(unresolvedCondition)
        .groupBy(deadLetterEventTable.eventType)
        .orderBy(sql`count(*) desc`),
    ]);

    return {
      totalUnresolved: totalResult[0]?.count ?? 0,
      byErrorCode,
      byEventType,
    };
  })

  /**
   * Replay a single dead-letter event (re-publish to Iggy).
   * POST /api/v1/dlq/:id/replay
   */
  .post(
    "/:id/replay",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(
        headers.authorization,
        headers["x-organization-id"],
      );
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (admin required for replay)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "admin",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      // Replay triggers workflow execution -- count against monthly run limit
      if (!(await isExecutionAllowed(organizationId))) {
        void recordUsage(
          "organization",
          organizationId,
          "rejected_executions",
          1,
        );
        return status(429, { error: "Monthly execution limit reached" });
      }

      const [dlqEvent] = await db
        .select()
        .from(deadLetterEventTable)
        .where(
          and(
            eq(deadLetterEventTable.id, params.id),
            eq(deadLetterEventTable.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!dlqEvent) {
        return status(404, { error: "DLQ event not found" });
      }

      if (dlqEvent.resolvedAt) {
        return status(409, { error: "Event already resolved" });
      }

      const eventsClient = await getEventsClient();
      if (!eventsClient) {
        return status(503, { error: "Event streaming is not configured" });
      }

      try {
        await eventsClient.publish({
          type: dlqEvent.eventType,
          source: dlqEvent.eventSource,
          data: dlqEvent.eventData as Record<string, unknown>,
          organizationId,
          correlationId: `replay-${dlqEvent.id}`,
        });

        // Mark as resolved after successful replay
        await db
          .update(deadLetterEventTable)
          .set({ resolvedAt: new Date() })
          .where(eq(deadLetterEventTable.id, dlqEvent.id));

        // Record usage to Aether (fire-and-forget)
        void recordUsage(
          "organization",
          organizationId,
          "workflow_executions",
          1,
          `dlq-replay-${dlqEvent.id}`,
        );

        logger.info("DLQ event replayed", {
          eventId: params.id,
          organizationId,
        });

        return { success: true, message: "Event replayed" };
      } catch (err) {
        logger.error("Failed to replay DLQ event", {
          eventId: params.id,
          error: err instanceof Error ? err.message : String(err),
        });

        return status(500, { error: "Failed to replay event" });
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  /**
   * Bulk replay dead-letter events by filter.
   * POST /api/v1/dlq/replay
   */
  .post(
    "/replay",
    async ({ body, headers, status }) => {
      const authInfo = await resolveAuth(
        headers.authorization,
        headers["x-organization-id"],
      );
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (admin required for bulk replay)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "admin",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      if (body.since && Number.isNaN(new Date(body.since).getTime())) {
        return status(400, { error: "Invalid 'since' date format" });
      }

      const eventsClient = await getEventsClient();
      if (!eventsClient) {
        return status(503, { error: "Event streaming is not configured" });
      }

      const maxLimit = Math.min(body.limit ?? 100, 1000);

      const conditions = buildConditions({
        organizationId,
        errorCode: body.errorCode,
        eventType: body.eventType,
        since: body.since,
      });

      const events = await db
        .select()
        .from(deadLetterEventTable)
        .where(and(...conditions))
        .orderBy(deadLetterEventTable.createdAt)
        .limit(maxLimit);

      // Bulk replay triggers N workflow executions -- check the entire
      // replay batch against the monthly run limit BEFORE publishing
      if (events.length > 0 && !(await isExecutionAllowed(organizationId, events.length))) {
        void recordUsage(
          "organization",
          organizationId,
          "rejected_executions",
          events.length,
        );
        return status(429, { error: "Monthly execution limit reached" });
      }

      let replayed = 0;
      let failed = 0;

      for (const dlqEvent of events) {
        try {
          await eventsClient.publish({
            type: dlqEvent.eventType,
            source: dlqEvent.eventSource,
            data: dlqEvent.eventData as Record<string, unknown>,
            organizationId,
            correlationId: `replay-${dlqEvent.id}`,
          });

          await db
            .update(deadLetterEventTable)
            .set({ resolvedAt: new Date() })
            .where(eq(deadLetterEventTable.id, dlqEvent.id));

          // Record usage to Aether (fire-and-forget)
          void recordUsage(
            "organization",
            organizationId,
            "workflow_executions",
            1,
            `dlq-replay-${dlqEvent.id}`,
          );

          replayed++;
        } catch (err) {
          failed++;
          logger.warn("Failed to replay DLQ event in bulk", {
            eventId: dlqEvent.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      logger.info("DLQ bulk replay completed", {
        organizationId,
        replayed,
        failed,
        total: events.length,
      });

      return { replayed, failed, total: events.length };
    },
    {
      body: t.Object({
        errorCode: t.Optional(t.String()),
        eventType: t.Optional(t.String()),
        since: t.Optional(t.String()),
        limit: t.Optional(t.Number()),
      }),
    },
  )

  /**
   * Discard a single dead-letter event (mark as resolved).
   * POST /api/v1/dlq/:id/discard
   */
  .post(
    "/:id/discard",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(
        headers.authorization,
        headers["x-organization-id"],
      );
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (admin required for discard)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "admin",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      const [dlqEvent] = await db
        .select({
          id: deadLetterEventTable.id,
          resolvedAt: deadLetterEventTable.resolvedAt,
        })
        .from(deadLetterEventTable)
        .where(
          and(
            eq(deadLetterEventTable.id, params.id),
            eq(deadLetterEventTable.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!dlqEvent) {
        return status(404, { error: "DLQ event not found" });
      }

      if (dlqEvent.resolvedAt) {
        return status(409, { error: "Event already resolved" });
      }

      await db
        .update(deadLetterEventTable)
        .set({ resolvedAt: new Date() })
        .where(eq(deadLetterEventTable.id, params.id));

      logger.info("DLQ event discarded", {
        eventId: params.id,
        organizationId,
      });

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  /**
   * Bulk discard dead-letter events by filter.
   * POST /api/v1/dlq/discard
   */
  .post(
    "/discard",
    async ({ body, headers, status }) => {
      const authInfo = await resolveAuth(
        headers.authorization,
        headers["x-organization-id"],
      );
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (admin required for bulk discard)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "admin",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      if (body.since && Number.isNaN(new Date(body.since).getTime())) {
        return status(400, { error: "Invalid 'since' date format" });
      }

      const conditions = buildConditions({
        organizationId,
        errorCode: body.errorCode,
        eventType: body.eventType,
        since: body.since,
      });

      const result = await db
        .update(deadLetterEventTable)
        .set({ resolvedAt: new Date() })
        .where(and(...conditions))
        .returning({ id: deadLetterEventTable.id });

      logger.info("DLQ bulk discard completed", {
        organizationId,
        discarded: result.length,
      });

      return { discarded: result.length };
    },
    {
      body: t.Object({
        errorCode: t.Optional(t.String()),
        eventType: t.Optional(t.String()),
        since: t.Optional(t.String()),
      }),
    },
  );

export default dlqRoutes;
