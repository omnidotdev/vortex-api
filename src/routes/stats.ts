import { and, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { getUsageSummary } from "lib/billing";
import { dbPool as db } from "lib/db/db";
import { workflowTable } from "lib/db/schema";
import { FEATURE_KEYS } from "lib/entitlements/constants";
import {
  getOrganizationTier,
  getPlanLimit,
} from "lib/entitlements/enforce";
import logger from "lib/logger";
import authorize from "lib/warden/authorize";

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
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed) return status(403, { error: "Access denied" });
      }

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
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed) return status(403, { error: "Access denied" });
      }

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
          (SELECT COUNT(*)::int FROM workflow WHERE organization_id = ${organizationId} AND is_active = true) AS active_workflows
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
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed) return status(403, { error: "Access denied" });
      }

      const since = query.since || defaultSince();
      const until = query.until || new Date().toISOString();
      const bucket = query.bucket || "day";

      if (!isValidDate(since))
        return status(400, { error: "Invalid 'since' date format" });
      if (!isValidDate(until))
        return status(400, { error: "Invalid 'until' date format" });

      // Validate and use sql.raw for date_trunc precision (not parameterizable in all PG configs)
      const precision = bucket === "hour" ? "hour" : "day";

      try {
        const result = await db.execute(sql`
          SELECT
            date_trunc(${sql.raw(`'${precision}'`)}, wr.created_at) AS timestamp,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE wr.status = 'completed')::int AS succeeded,
            COUNT(*) FILTER (WHERE wr.status = 'failed')::int AS failed
          FROM workflow_run wr
          INNER JOIN workflow w ON w.id = wr.workflow_id
          WHERE w.organization_id = ${organizationId}
            AND wr.created_at >= ${since}
            AND wr.created_at <= ${until}
          GROUP BY date_trunc(${sql.raw(`'${precision}'`)}, wr.created_at)
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
      } catch (err) {
        logger.error("Stats timeline query failed", {
          error: err instanceof Error ? err.message : String(err),
          organizationId,
          since,
          until,
          bucket: precision,
        });
        return status(500, { error: "Failed to fetch timeline data" });
      }
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
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed) return status(403, { error: "Access denied" });
      }

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
  )

  /**
   * Current active (running) workflow runs for the organization.
   * GET /api/v1/stats/concurrency
   */
  .get("/concurrency", async ({ headers, status }) => {
    const authInfo = await resolveAuth(headers.authorization);
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    if (authInfo.userId) {
      const allowed = await authorize(
        authInfo.idpUserId!,
        "organization",
        organizationId,
        "member",
      );
      if (!allowed) return status(403, { error: "Access denied" });
    }

    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS active_runs
      FROM workflow_run
      WHERE status = 'running'
        AND workflow_id IN (
          SELECT id FROM workflow WHERE organization_id = ${organizationId}
        )
    `);

    const row = result.rows[0] as Record<string, unknown>;

    return { activeRuns: Number(row.active_runs ?? 0) };
  })

  /**
   * Usage summary from Aether billing.
   * GET /api/v1/stats/usage
   */
  .get("/usage", async ({ headers, status }) => {
    const authInfo = await resolveAuth(headers.authorization);
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    if (authInfo.userId) {
      const allowed = await authorize(
        authInfo.idpUserId!,
        "organization",
        organizationId,
        "member",
      );
      if (!allowed) return status(403, { error: "Access denied" });
    }

    const summary = await getUsageSummary("organization", organizationId);

    if (!summary) {
      return status(503, { error: "Usage data unavailable" });
    }

    return summary;
  })

  /**
   * Current tier and operational limits for the caller's organization.
   * GET /api/v1/stats/tier
   *
   * Sources limits from Aether entitlements (omni-api planConfigs is the SSOT).
   * Returns -1 for unlimited values
   */
  .get("/tier", async ({ headers, status }) => {
    const authInfo = await resolveAuth(headers.authorization);
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    if (authInfo.userId) {
      const allowed = await authorize(
        authInfo.idpUserId!,
        "organization",
        organizationId,
        "member",
      );
      if (!allowed) return status(403, { error: "Access denied" });
    }

    const [
      tier,
      maxWorkflows,
      maxExecutionsPerMonth,
      maxIntegrations,
      maxPlugins,
      maxUsers,
      maxFunctions,
      maxSubscriptions,
      maxMcpServers,
      maxRoutingRules,
      maxEventSchemas,
      ssoEnabled,
      auditLogs,
      customPlugins,
    ] = await Promise.all([
      getOrganizationTier(organizationId),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_WORKFLOWS),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_EXECUTIONS_PER_MONTH),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_INTEGRATIONS),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_PLUGINS),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_USERS),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_FUNCTIONS),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_SUBSCRIPTIONS),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_MCP_SERVERS),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_ROUTING_RULES),
      getPlanLimit(organizationId, FEATURE_KEYS.MAX_EVENT_SCHEMAS),
      getPlanLimit(organizationId, FEATURE_KEYS.SSO_ENABLED),
      getPlanLimit(organizationId, FEATURE_KEYS.AUDIT_LOGS),
      getPlanLimit(organizationId, FEATURE_KEYS.CUSTOM_PLUGINS),
    ]);

    return {
      tier,
      limits: {
        max_workflows: maxWorkflows,
        max_executions_per_month: maxExecutionsPerMonth,
        max_integrations: maxIntegrations,
        max_plugins: maxPlugins,
        max_users: maxUsers,
        max_functions: maxFunctions,
        max_subscriptions: maxSubscriptions,
        max_mcp_servers: maxMcpServers,
        max_routing_rules: maxRoutingRules,
        max_event_schemas: maxEventSchemas,
        sso_enabled: ssoEnabled,
        audit_logs: auditLogs,
        custom_plugins: customPlugins,
      },
    };
  });

export default statsRoutes;
