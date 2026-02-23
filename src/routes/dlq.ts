import Hatchet from "@hatchet-dev/typescript-sdk";
import { and, count, eq, isNull, max, min } from "drizzle-orm";
import { Elysia, t } from "elysia";

import validateApiKey from "lib/auth/apiKey";
import { dbPool as db } from "lib/db/db";
import {
  deadLetterEventTable,
  eventRoutingRuleTable,
  workflowRunTable,
  workflowTable,
} from "lib/db/schema";
import logger from "lib/logger";

let _hatchet: ReturnType<typeof Hatchet.init> | null = null;

function getHatchet(): ReturnType<typeof Hatchet.init> | null {
  if (!_hatchet) {
    try {
      _hatchet = Hatchet.init();
    } catch {
      logger.warn("Hatchet not configured - DLQ replay unavailable");
    }
  }
  return _hatchet;
}

/**
 * Dead Letter Queue management routes.
 *
 * Inspect, replay, resolve, and discard failed events from the
 * Postgres-backed dead_letter_event table.
 */
const dlqRoutes = new Elysia({ prefix: "/events/dlq" })
  /**
   * List DLQ events (paginated, filterable).
   * GET /api/v1/events/dlq
   */
  .get(
    "/",
    async ({ query, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;
      const page = Number(query.page ?? 1);
      const limit = Math.min(Number(query.limit ?? 20), 100);
      const offset = (page - 1) * limit;
      const unresolvedOnly = query.unresolvedOnly === "true";

      const conditions = [
        eq(deadLetterEventTable.organizationId, organizationId),
      ];

      if (unresolvedOnly) {
        conditions.push(isNull(deadLetterEventTable.resolvedAt));
      }

      if (query.workflowId) {
        // Join through routing rule to filter by workflow
        const ruleIds = await db
          .select({ id: eventRoutingRuleTable.id })
          .from(eventRoutingRuleTable)
          .where(eq(eventRoutingRuleTable.workflowId, query.workflowId));

        if (ruleIds.length === 0) {
          return { nodes: [], total: 0, page, limit };
        }

        // Filter DLQ events by matching routing rule IDs
        const allEvents = await db
          .select()
          .from(deadLetterEventTable)
          .where(and(...conditions))
          .orderBy(deadLetterEventTable.createdAt)
          .limit(limit + 1)
          .offset(offset);

        const ruleIdSet = new Set(ruleIds.map((r) => r.id));
        const filtered = allEvents.filter((e) =>
          ruleIdSet.has(e.routingRuleId),
        );

        return {
          nodes: filtered.slice(0, limit),
          total:
            filtered.length > limit
              ? offset + limit + 1
              : offset + filtered.length,
          page,
          limit,
        };
      }

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
        workflowId: t.Optional(t.String()),
        unresolvedOnly: t.Optional(t.String()),
      }),
    },
  )
  /**
   * Get DLQ stats (total count, oldest/newest event).
   * GET /api/v1/events/dlq/stats
   */
  .get("/stats", async ({ headers, status }) => {
    const apiKeyInfo = await validateApiKey(headers.authorization);
    if (!apiKeyInfo)
      return status(401, { error: "Invalid or missing API key" });

    const { organizationId } = apiKeyInfo;

    const [result] = await db
      .select({
        totalEvents: count(),
        oldestEvent: min(deadLetterEventTable.createdAt),
        newestEvent: max(deadLetterEventTable.createdAt),
      })
      .from(deadLetterEventTable)
      .where(
        and(
          eq(deadLetterEventTable.organizationId, organizationId),
          isNull(deadLetterEventTable.resolvedAt),
        ),
      );

    return {
      totalEvents: result?.totalEvents ?? 0,
      oldestEvent: result?.oldestEvent ?? null,
      newestEvent: result?.newestEvent ?? null,
    };
  })
  /**
   * Replay a DLQ event (re-publish to Hatchet and mark resolved).
   * POST /api/v1/events/dlq/:eventId/replay
   */
  .post(
    "/:eventId/replay",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;

      const [dlqEvent] = await db
        .select()
        .from(deadLetterEventTable)
        .where(
          and(
            eq(deadLetterEventTable.id, params.eventId),
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

      // Look up the routing rule to find the target workflow
      const rule = await db.query.eventRoutingRuleTable.findFirst({
        where: eq(eventRoutingRuleTable.id, dlqEvent.routingRuleId),
      });

      if (!rule) {
        return status(404, { error: "Routing rule not found" });
      }

      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, rule.workflowId),
          eq(workflowTable.isActive, true),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Target workflow not found or inactive" });
      }

      const hatchet = getHatchet();
      if (!hatchet) {
        return status(503, { error: "Hatchet not configured" });
      }

      try {
        const engineWorkflowId = `dlq-replay-${workflow.id}-${Date.now()}`;
        const engineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const [run] = await db
          .insert(workflowRunTable)
          .values({
            workflowId: workflow.id,
            engineWorkflowId,
            engineRunId,
            status: "pending",
            input: {
              event: {
                id: dlqEvent.originalEventId,
                type: dlqEvent.eventType,
                source: dlqEvent.eventSource,
                data: dlqEvent.eventData,
              },
            },
          })
          .returning();

        await hatchet.event.push("workflow:execute", {
          workflowId: engineWorkflowId,
          runId: run.id,
          organizationId,
          triggerData: {
            event: {
              id: dlqEvent.originalEventId,
              type: dlqEvent.eventType,
              source: dlqEvent.eventSource,
              data: dlqEvent.eventData,
            },
          },
          definition: workflow.definition,
        });

        // Mark as resolved
        await db
          .update(deadLetterEventTable)
          .set({ resolvedAt: new Date() })
          .where(eq(deadLetterEventTable.id, dlqEvent.id));

        logger.info("DLQ event replayed", {
          eventId: params.eventId,
          runId: run.id,
          organizationId,
        });

        return { success: true, message: "Event replayed", runId: run.id };
      } catch (err) {
        logger.error("Failed to replay DLQ event", {
          eventId: params.eventId,
          error: err instanceof Error ? err.message : String(err),
        });

        return status(500, { error: "Failed to replay event" });
      }
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    },
  )
  /**
   * Discard a DLQ event (mark as resolved without replay).
   * DELETE /api/v1/events/dlq/:eventId
   */
  .delete(
    "/:eventId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;

      const [dlqEvent] = await db
        .select({ id: deadLetterEventTable.id })
        .from(deadLetterEventTable)
        .where(
          and(
            eq(deadLetterEventTable.id, params.eventId),
            eq(deadLetterEventTable.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!dlqEvent) {
        return status(404, { error: "DLQ event not found" });
      }

      await db
        .update(deadLetterEventTable)
        .set({ resolvedAt: new Date() })
        .where(eq(deadLetterEventTable.id, params.eventId));

      logger.info("DLQ event discarded", {
        eventId: params.eventId,
        organizationId,
      });

      return { success: true };
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    },
  )
  /**
   * Retry all unresolved DLQ events for the organization.
   * POST /api/v1/events/dlq/retry-all
   */
  .post("/retry-all", async ({ headers, status }) => {
    const apiKeyInfo = await validateApiKey(headers.authorization);
    if (!apiKeyInfo)
      return status(401, { error: "Invalid or missing API key" });

    const { organizationId } = apiKeyInfo;

    const hatchet = getHatchet();
    if (!hatchet) {
      return status(503, { error: "Hatchet not configured" });
    }

    const unresolvedEvents = await db
      .select()
      .from(deadLetterEventTable)
      .where(
        and(
          eq(deadLetterEventTable.organizationId, organizationId),
          isNull(deadLetterEventTable.resolvedAt),
        ),
      );

    let retried = 0;
    let failed = 0;

    for (const dlqEvent of unresolvedEvents) {
      try {
        const rule = await db.query.eventRoutingRuleTable.findFirst({
          where: eq(eventRoutingRuleTable.id, dlqEvent.routingRuleId),
        });

        if (!rule) {
          failed++;
          continue;
        }

        const workflow = await db.query.workflowTable.findFirst({
          where: and(
            eq(workflowTable.id, rule.workflowId),
            eq(workflowTable.isActive, true),
          ),
        });

        if (!workflow) {
          failed++;
          continue;
        }

        const engineWorkflowId = `dlq-retry-${workflow.id}-${Date.now()}`;
        const engineRunId = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const [run] = await db
          .insert(workflowRunTable)
          .values({
            workflowId: workflow.id,
            engineWorkflowId,
            engineRunId,
            status: "pending",
            input: {
              event: {
                id: dlqEvent.originalEventId,
                type: dlqEvent.eventType,
                source: dlqEvent.eventSource,
                data: dlqEvent.eventData,
              },
            },
          })
          .returning();

        await hatchet.event.push("workflow:execute", {
          workflowId: engineWorkflowId,
          runId: run.id,
          organizationId,
          triggerData: {
            event: {
              id: dlqEvent.originalEventId,
              type: dlqEvent.eventType,
              source: dlqEvent.eventSource,
              data: dlqEvent.eventData,
            },
          },
          definition: workflow.definition,
        });

        await db
          .update(deadLetterEventTable)
          .set({ resolvedAt: new Date() })
          .where(eq(deadLetterEventTable.id, dlqEvent.id));

        retried++;
      } catch (err) {
        failed++;
        logger.error("Failed to retry DLQ event", {
          eventId: dlqEvent.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("DLQ retry-all completed", {
      organizationId,
      retried,
      failed,
      total: unresolvedEvents.length,
    });

    return { retried, failed, total: unresolvedEvents.length };
  })
  /**
   * Resolve a DLQ event without replay.
   * PATCH /api/v1/events/dlq/:eventId/resolve
   */
  .patch(
    "/:eventId/resolve",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;

      const [dlqEvent] = await db
        .select({
          id: deadLetterEventTable.id,
          resolvedAt: deadLetterEventTable.resolvedAt,
        })
        .from(deadLetterEventTable)
        .where(
          and(
            eq(deadLetterEventTable.id, params.eventId),
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
        .where(eq(deadLetterEventTable.id, params.eventId));

      logger.info("DLQ event resolved", {
        eventId: params.eventId,
        organizationId,
      });

      return { success: true };
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    },
  );

export default dlqRoutes;
