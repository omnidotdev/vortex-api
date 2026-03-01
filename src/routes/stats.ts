import { and, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import validateApiKey from "lib/auth/apiKey";
import { dbPool as db } from "lib/db/db";
import { workflowTable } from "lib/db/schema";

/**
 * Default time range: 7 days ago.
 */
const defaultSince = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
};

/**
 * Validate an ISO date string.
 * @param value - Candidate date string.
 * @returns Whether the value parses to a valid date.
 */
const isValidDate = (value: string) => !Number.isNaN(new Date(value).getTime());

/**
 * Execution stats aggregate endpoints.
 *
 * Per-workflow stats, org-wide stats, execution timeline (for charts),
 * and top errors. Powers the monitoring dashboard.
 */
const statsRoutes = new Elysia({ prefix: "/stats" })
  /**
   * Per-workflow execution stats.
   * GET /api/v1/stats/workflows/:workflowId
   */
  .get(
    "/workflows/:workflowId",
    async ({ params, query, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;
      const { workflowId } = params;
      const since = query.since || defaultSince();
      const until = query.until || new Date().toISOString();

      if (!isValidDate(since))
        return status(400, { error: "Invalid 'since' date format" });
      if (!isValidDate(until))
        return status(400, { error: "Invalid 'until' date format" });

      // Verify workflow belongs to caller's organization
      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
        columns: { id: true },
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)
              FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL),
            0
          )::float AS avg_duration_ms,
          COALESCE(
            PERCENTILE_CONT(0.95) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
            ) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL),
            0
          )::float AS p95_duration_ms
        FROM workflow_run
        WHERE workflow_id = ${workflowId}
          AND created_at >= ${since}
          AND created_at <= ${until}
      `);

      const row = result.rows[0] as Record<string, unknown>;

      return {
        workflowId,
        period: { since, until },
        total: Number(row.total ?? 0),
        succeeded: Number(row.succeeded ?? 0),
        failed: Number(row.failed ?? 0),
        cancelled: Number(row.cancelled ?? 0),
        avgDurationMs: Math.round(Number(row.avg_duration_ms ?? 0)),
        p95DurationMs: Math.round(Number(row.p95_duration_ms ?? 0)),
      };
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
      query: t.Object({
        since: t.Optional(t.String()),
        until: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Org-wide execution stats.
   * GET /api/v1/stats/organization
   */
  .get(
    "/organization",
    async ({ query, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;
      const since = query.since || defaultSince();
      const until = query.until || new Date().toISOString();

      if (!isValidDate(since))
        return status(400, { error: "Invalid 'since' date format" });
      if (!isValidDate(until))
        return status(400, { error: "Invalid 'until' date format" });

      const result = await db.execute(sql`
        SELECT
          COUNT(wr.*)::int AS total,
          COUNT(*) FILTER (WHERE wr.status = 'completed')::int AS succeeded,
          COUNT(*) FILTER (WHERE wr.status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE wr.status = 'cancelled')::int AS cancelled,
          COUNT(DISTINCT wr.workflow_id)::int AS active_workflows
        FROM workflow_run wr
        INNER JOIN workflow w ON w.id = wr.workflow_id
        WHERE w.organization_id = ${organizationId}
          AND wr.created_at >= ${since}
          AND wr.created_at <= ${until}
      `);

      const row = result.rows[0] as Record<string, unknown>;

      return {
        organizationId,
        period: { since, until },
        total: Number(row.total ?? 0),
        succeeded: Number(row.succeeded ?? 0),
        failed: Number(row.failed ?? 0),
        cancelled: Number(row.cancelled ?? 0),
        activeWorkflows: Number(row.active_workflows ?? 0),
      };
    },
    {
      query: t.Object({
        since: t.Optional(t.String()),
        until: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Execution timeline (bucketed by hour or day).
   * GET /api/v1/stats/timeline
   */
  .get(
    "/timeline",
    async ({ query, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;
      const since = query.since || defaultSince();
      const until = query.until || new Date().toISOString();
      const bucket = query.bucket || "day";

      if (!isValidDate(since))
        return status(400, { error: "Invalid 'since' date format" });
      if (!isValidDate(until))
        return status(400, { error: "Invalid 'until' date format" });

      const result = await db.execute(sql`
        SELECT
          date_trunc(${bucket}, wr.created_at) AS timestamp,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE wr.status = 'completed')::int AS succeeded,
          COUNT(*) FILTER (WHERE wr.status = 'failed')::int AS failed
        FROM workflow_run wr
        INNER JOIN workflow w ON w.id = wr.workflow_id
        WHERE w.organization_id = ${organizationId}
          AND wr.created_at >= ${since}
          AND wr.created_at <= ${until}
        GROUP BY date_trunc(${bucket}, wr.created_at)
        ORDER BY timestamp ASC
      `);

      const data = result.rows.map((row: Record<string, unknown>) => ({
        timestamp: row.timestamp,
        total: Number(row.total ?? 0),
        succeeded: Number(row.succeeded ?? 0),
        failed: Number(row.failed ?? 0),
      }));

      return {
        period: { since, until },
        bucket,
        data,
      };
    },
    {
      query: t.Object({
        since: t.Optional(t.String()),
        until: t.Optional(t.String()),
        bucket: t.Optional(t.Union([t.Literal("hour"), t.Literal("day")])),
      }),
    },
  )

  /**
   * Top errors across workflow runs.
   * GET /api/v1/stats/errors
   */
  .get(
    "/errors",
    async ({ query, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;
      const since = query.since || defaultSince();
      const limit = Math.min(Number(query.limit ?? 10), 50);

      if (!isValidDate(since))
        return status(400, { error: "Invalid 'since' date format" });

      const result = await db.execute(sql`
        SELECT
          wr.error,
          w.name AS workflow_name,
          w.id AS workflow_id,
          COUNT(*)::int AS occurrences,
          MAX(wr.created_at) AS last_seen
        FROM workflow_run wr
        INNER JOIN workflow w ON w.id = wr.workflow_id
        WHERE w.organization_id = ${organizationId}
          AND wr.status = 'failed'
          AND wr.error IS NOT NULL
          AND wr.created_at >= ${since}
        GROUP BY wr.error, w.name, w.id
        ORDER BY occurrences DESC
        LIMIT ${limit}
      `);

      const errors = result.rows.map((row: Record<string, unknown>) => ({
        error: row.error,
        workflowName: row.workflow_name,
        workflowId: row.workflow_id,
        occurrences: Number(row.occurrences ?? 0),
        lastSeen: row.last_seen,
      }));

      return { errors };
    },
    {
      query: t.Object({
        since: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  );

export default statsRoutes;
