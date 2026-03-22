import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { dbPool as db } from "lib/db/db";
import { pluginMarketplaceTable, pluginTable } from "lib/db/schema";
import { FEATURE_KEYS } from "lib/entitlements/constants";
import { getPlanLimit } from "lib/entitlements/enforce";
import logger from "lib/logger";
import authorize from "lib/warden/authorize";

/**
 * Plugin marketplace routes.
 *
 * Public registry of published WASM plugins.
 * Browse, publish, and install plugins.
 */
const marketplaceRoutes = new Elysia({ prefix: "/marketplace/plugins" })
  /**
   * Browse published plugins (public, paginated, searchable).
   * GET /api/v1/marketplace/plugins
   */
  .get(
    "/",
    async ({ query }) => {
      const page = Number(query.page ?? 1);
      const limit = Math.min(Number(query.limit ?? 20), 100);
      const offset = (page - 1) * limit;

      const conditions = [];

      if (query.q?.trim()) {
        const q = query.q.trim();
        conditions.push(
          or(
            ilike(pluginMarketplaceTable.name, `%${q}%`),
            ilike(pluginMarketplaceTable.description, `%${q}%`),
          ),
        );
      }

      if (query.verified === "true") {
        conditions.push(eq(pluginMarketplaceTable.isVerified, true));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [plugins, totalResult] = await Promise.all([
        db
          .select()
          .from(pluginMarketplaceTable)
          .where(where)
          .orderBy(desc(pluginMarketplaceTable.downloads))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(pluginMarketplaceTable).where(where),
      ]);

      return {
        nodes: plugins,
        total: totalResult[0]?.count ?? 0,
        page,
        limit,
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        q: t.Optional(t.String()),
        verified: t.Optional(t.String()),
      }),
    },
  )
  /**
   * Publish a plugin to the marketplace.
   * POST /api/v1/marketplace/plugins
   */
  .post(
    "/",
    async ({ body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (admin required for publish)
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

      try {
        const [plugin] = await db
          .insert(pluginMarketplaceTable)
          .values({
            name: body.name,
            description: body.description,
            author: body.author,
            version: body.version,
            wasmUrl: body.wasmUrl,
            manifest: body.manifest,
            tags: body.tags,
          })
          .returning();

        logger.info("Plugin published to marketplace", {
          pluginId: plugin.id,
          name: body.name,
          version: body.version,
        });

        return plugin;
      } catch (err) {
        logger.error("Marketplace publish failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to publish plugin" });
      }
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        author: t.String(),
        version: t.String(),
        wasmUrl: t.String(),
        manifest: t.Any(),
        tags: t.Optional(t.Array(t.String())),
      }),
    },
  )
  /**
   * Install a marketplace plugin to an organization's plugin registry.
   * POST /api/v1/marketplace/plugins/:id/install
   */
  .post(
    "/:id/install",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (member required for install)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.idpUserId!,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      // Look up marketplace plugin
      const marketplacePlugin = await db.query.pluginMarketplaceTable.findFirst(
        {
          where: eq(pluginMarketplaceTable.id, params.id),
        },
      );

      if (!marketplacePlugin)
        return status(404, { error: "Marketplace plugin not found" });

      // Enforce plugin plan limit
      const [pluginLimit, existingPlugins] = await Promise.all([
        getPlanLimit(organizationId, FEATURE_KEYS.MAX_PLUGINS),
        db.query.pluginTable.findMany({
          where: eq(pluginTable.organizationId, organizationId),
          columns: { id: true },
        }),
      ]);

      if (pluginLimit !== -1 && existingPlugins.length >= pluginLimit) {
        return status(403, {
          error: `Plan limit reached: plugins (${existingPlugins.length}/${pluginLimit}). Upgrade your plan to continue.`,
        });
      }

      try {
        // Copy to org's plugin registry
        const [installed] = await db
          .insert(pluginTable)
          .values({
            organizationId,
            name: marketplacePlugin.name,
            version: marketplacePlugin.version,
            description: marketplacePlugin.description,
            manifest: marketplacePlugin.manifest,
            wasmUrl: marketplacePlugin.wasmUrl,
            wasmHash: "",
            isEnabled: true,
          })
          .returning();

        // Increment download count
        await db
          .update(pluginMarketplaceTable)
          .set({
            downloads: sql`${pluginMarketplaceTable.downloads} + 1`,
          })
          .where(eq(pluginMarketplaceTable.id, params.id));

        logger.info("Marketplace plugin installed", {
          organizationId,
          marketplacePluginId: params.id,
          installedPluginId: installed.id,
        });

        return {
          success: true,
          pluginId: installed.id,
        };
      } catch (err) {
        logger.error("Marketplace install failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to install plugin" });
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  );

export default marketplaceRoutes;
