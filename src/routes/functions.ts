import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { FEATURE_KEYS } from "lib/aether/client";
import validateApiKey from "lib/auth/apiKey";
import { dbPool as db } from "lib/db/db";
import { pluginTable, pluginUsageTable } from "lib/db/schema";
import { getPlanLimit } from "lib/entitlements/enforce";
import logger from "lib/logger";

/**
 * FaaS function routes.
 *
 * Execute WASM plugins directly via HTTP (OpenFaaS-style).
 */
const functionRoutes = new Elysia({ prefix: "/functions" })
  /**
   * List available functions for the organization.
   * GET /api/v1/functions
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

      const plugins = await db
        .select({
          id: pluginTable.id,
          name: pluginTable.name,
          version: pluginTable.version,
          description: pluginTable.description,
          manifest: pluginTable.manifest,
        })
        .from(pluginTable)
        .where(
          and(
            eq(pluginTable.organizationId, organizationId),
            eq(pluginTable.isEnabled, true),
          ),
        )
        .limit(limit)
        .offset(offset);

      return { nodes: plugins, page, limit };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  /**
   * Get function details (plugin manifest + usage stats).
   * GET /api/v1/functions/:pluginId
   */
  .get(
    "/:pluginId",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;

      const plugin = await db.query.pluginTable.findFirst({
        where: and(
          eq(pluginTable.id, params.pluginId),
          eq(pluginTable.organizationId, organizationId),
          eq(pluginTable.isEnabled, true),
        ),
      });

      if (!plugin) return status(404, { error: "Function not found" });

      return {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        manifest: plugin.manifest,
      };
    },
    {
      params: t.Object({
        pluginId: t.String(),
      }),
    },
  )
  /**
   * Invoke a function (execute a WASM plugin directly).
   * POST /api/v1/functions/:pluginId/invoke
   */
  .post(
    "/:pluginId/invoke",
    async ({ params, body, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo)
        return status(401, { error: "Invalid or missing API key" });

      const { organizationId } = apiKeyInfo;
      const { pluginId } = params;
      const startTime = performance.now();

      // Look up plugin
      const plugin = await db.query.pluginTable.findFirst({
        where: and(
          eq(pluginTable.id, pluginId),
          eq(pluginTable.organizationId, organizationId),
        ),
      });

      if (!plugin) return status(404, { error: "Function not found" });

      if (!plugin.isEnabled) {
        return status(400, { error: "Function is disabled" });
      }

      // Enforce plan limit
      const runLimit = await getPlanLimit(
        organizationId,
        FEATURE_KEYS.MAX_RUNS_PER_MONTH,
      );

      if (runLimit !== -1) {
        // TODO: count function invocations this month against the limit
      }

      try {
        // TODO: Execute WASM plugin via ExtismPluginHost
        // For now, record the invocation and return a placeholder
        const durationMs = Math.round(performance.now() - startTime);

        const functionName =
          (body as Record<string, unknown>).function?.toString() ?? "run";

        await db.insert(pluginUsageTable).values({
          pluginId,
          organizationId,
          functionName,
          durationMs,
          success: true,
          invocationSource: "function",
        });

        logger.info("Function invoked", {
          organizationId,
          pluginId,
          functionName,
          durationMs,
        });

        return {
          success: true,
          output: {},
          durationMs,
        };
      } catch (err) {
        const durationMs = Math.round(performance.now() - startTime);

        logger.error("Function invocation failed", {
          organizationId,
          pluginId,
          error: err instanceof Error ? err.message : String(err),
        });

        return status(500, {
          success: false,
          error: err instanceof Error ? err.message : "Invocation failed",
          durationMs,
        });
      }
    },
    {
      params: t.Object({
        pluginId: t.String(),
      }),
      body: t.Optional(t.Record(t.String(), t.Unknown())),
    },
  );

export default functionRoutes;
