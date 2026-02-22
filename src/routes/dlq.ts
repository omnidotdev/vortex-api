import { Elysia, t } from "elysia";

import validateApiKey from "lib/auth/apiKey";
import logger from "lib/logger";

/**
 * Dead Letter Queue inspection routes.
 *
 * Inspect, replay, and discard failed events from the DLQ.
 * Backed by Iggy DLQ topics managed by vortex-worker.
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

      logger.debug("DLQ list requested", {
        organizationId,
        page,
        limit,
        workflowId: query.workflowId,
      });

      // TODO: Query Iggy DLQ topic for the org's events
      // The DLQ reader in vortex-worker (events/dlq.ts) provides the
      // listDlqEvents, getDlqStats functions. This endpoint will call
      // the worker's internal API or directly connect to Iggy.
      return {
        nodes: [],
        total: 0,
        page,
        limit,
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        workflowId: t.Optional(t.String()),
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

    logger.debug("DLQ stats requested", { organizationId });

    // TODO: Connect to Iggy DLQ topic for stats
    return {
      totalEvents: 0,
      oldestEvent: null,
      newestEvent: null,
    };
  })
  /**
   * Replay a DLQ event (re-publish to original topic).
   * POST /api/v1/events/dlq/:eventId/replay
   */
  .post(
    "/:eventId/replay",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;

      logger.info("DLQ event replay requested", {
        organizationId,
        eventId: params.eventId,
      });

      // TODO: Look up event in Iggy DLQ, re-publish to original topic
      return { success: true, message: "Event replayed" };
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    },
  )
  /**
   * Discard a DLQ event (acknowledge and remove).
   * DELETE /api/v1/events/dlq/:eventId
   */
  .delete(
    "/:eventId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;

      logger.info("DLQ event discard requested", {
        organizationId,
        eventId: params.eventId,
      });

      // TODO: Advance consumer offset past this event in Iggy DLQ
      return { success: true };
    },
    {
      params: t.Object({
        eventId: t.String(),
      }),
    },
  );

export default dlqRoutes;
