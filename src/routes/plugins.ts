import { createHash } from "node:crypto";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import {
  PLUGIN_STORAGE_BASE_URL,
  PLUGIN_STORAGE_BUCKET,
} from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { pluginTable, pluginUsageTable } from "lib/db/schema";
import { FEATURE_KEYS } from "lib/entitlements/constants";
import { checkFeatureEnabled } from "lib/entitlements/enforce";
import logger from "lib/logger";
import authorize from "lib/warden/authorize";

const s3 = new S3Client({});

/**
 * Plugin marketplace routes.
 *
 * Provides WASM plugin upload and management endpoints.
 */
const pluginRoutes = new Elysia({ prefix: "/plugins" })
  /**
   * List plugins for the organization (paginated).
   * GET /api/v1/plugins
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

      const [plugins, totalResult] = await Promise.all([
        db
          .select()
          .from(pluginTable)
          .where(eq(pluginTable.organizationId, organizationId))
          .orderBy(desc(pluginTable.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(pluginTable)
          .where(eq(pluginTable.organizationId, organizationId)),
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
      }),
    },
  )
  /**
   * Full-text search plugins by name or description.
   * GET /api/v1/plugins/search?q=term
   */
  .get(
    "/search",
    async ({ query, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;
      const q = query.q?.trim();

      if (!q) return { nodes: [] };

      const plugins = await db
        .select()
        .from(pluginTable)
        .where(
          and(
            eq(pluginTable.organizationId, organizationId),
            or(
              ilike(pluginTable.name, `%${q}%`),
              ilike(pluginTable.description, `%${q}%`),
            ),
          ),
        )
        .orderBy(desc(pluginTable.createdAt))
        .limit(50);

      return { nodes: plugins };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
      }),
    },
  )
  /**
   * Get a single plugin with aggregated usage stats.
   * GET /api/v1/plugins/:id
   */
  .get("/:id", async ({ params, headers, status }) => {
    const authInfo = await resolveAuth(headers.authorization);
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    const plugin = await db.query.pluginTable.findFirst({
      where: and(
        eq(pluginTable.id, params.id),
        eq(pluginTable.organizationId, organizationId),
      ),
    });

    if (!plugin) return status(404, { error: "Plugin not found" });

    // Aggregate usage stats
    const usageStats = await db
      .select({
        totalCalls: count(),
        successCalls: sql<number>`sum(case when ${pluginUsageTable.success} then 1 else 0 end)::int`,
        avgDurationMs: sql<number>`avg(${pluginUsageTable.durationMs})::int`,
        lastExecutedAt: sql<string>`max(${pluginUsageTable.executedAt})`,
      })
      .from(pluginUsageTable)
      .where(eq(pluginUsageTable.pluginId, params.id));

    const stats = usageStats[0] ?? {
      totalCalls: 0,
      successCalls: 0,
      avgDurationMs: 0,
      lastExecutedAt: null,
    };

    return {
      ...plugin,
      usage: {
        totalCalls: stats.totalCalls,
        successCalls: stats.successCalls,
        failedCalls: stats.totalCalls - (stats.successCalls ?? 0),
        successRate:
          stats.totalCalls > 0
            ? Math.round(((stats.successCalls ?? 0) / stats.totalCalls) * 100)
            : 100,
        avgDurationMs: stats.avgDurationMs,
        lastExecutedAt: stats.lastExecutedAt,
      },
    };
  })
  /**
   * Get all versions of a plugin by name.
   * GET /api/v1/plugins/:id/versions
   */
  .get("/:id/versions", async ({ params, headers, status }) => {
    const authInfo = await resolveAuth(headers.authorization);
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    const plugins = await db
      .select()
      .from(pluginTable)
      .where(
        and(
          eq(pluginTable.organizationId, organizationId),
          eq(pluginTable.name, params.id),
        ),
      )
      .orderBy(desc(pluginTable.createdAt));

    return { nodes: plugins };
  })
  /**
   * Upload a WASM plugin to the marketplace.
   * POST /api/v1/plugins/upload
   */
  .post(
    "/upload",
    async ({ body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (member required for upload)
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

      const pluginsEnabled = await checkFeatureEnabled(
        organizationId,
        FEATURE_KEYS.CUSTOM_PLUGINS,
      );
      if (!pluginsEnabled) {
        return status(403, {
          error: "Custom plugins are not available on your current plan",
        });
      }

      if (!PLUGIN_STORAGE_BUCKET) {
        return status(501, {
          error: "Plugin storage not configured — set PLUGIN_STORAGE_BUCKET",
        });
      }

      const bucket = PLUGIN_STORAGE_BUCKET;

      try {
        const wasmBuffer = Buffer.from(await body.wasm.arrayBuffer());
        const sha256 = createHash("sha256").update(wasmBuffer).digest("hex");

        let manifest: Record<string, unknown>;
        try {
          manifest = JSON.parse(body.manifest) as Record<string, unknown>;
        } catch {
          return status(400, { error: "Invalid manifest JSON" });
        }

        if (manifest.wasm !== undefined) {
          return status(400, {
            error:
              "manifest.wasm is reserved — omit it from the upload payload",
          });
        }

        const key = `plugins/${organizationId}/${sha256}.wasm`;
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: wasmBuffer,
            ContentType: "application/wasm",
          }),
        );

        const baseUrl =
          PLUGIN_STORAGE_BASE_URL ?? `https://${bucket}.s3.amazonaws.com`;
        const wasmUrl = `${baseUrl}/${key}`;

        manifest.wasm = { url: wasmUrl };

        const [plugin] = await db
          .insert(pluginTable)
          .values({
            organizationId,
            name: body.name,
            version: body.version,
            description: body.description,
            manifest,
            wasmUrl,
            wasmHash: sha256,
          })
          .returning();

        logger.info("Plugin uploaded", {
          organizationId,
          pluginId: plugin.id,
          name: body.name,
          version: body.version,
          sha256,
        });

        return plugin;
      } catch (err) {
        logger.error("Plugin upload failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to upload plugin" });
      }
    },
    {
      body: t.Object({
        wasm: t.File({ type: "application/wasm", maxSize: "10m" }),
        name: t.String(),
        version: t.String(),
        description: t.Optional(t.String()),
        manifest: t.String(),
      }),
    },
  )
  /**
   * Update a plugin (enable/disable, update config).
   * PATCH /api/v1/plugins/:id
   */
  .patch(
    "/:id",
    async ({ params, body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (member required for update)
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

      const existing = await db.query.pluginTable.findFirst({
        where: and(
          eq(pluginTable.id, params.id),
          eq(pluginTable.organizationId, organizationId),
        ),
      });

      if (!existing) return status(404, { error: "Plugin not found" });

      const updates: Partial<typeof pluginTable.$inferInsert> = {};

      if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;
      if (body.config !== undefined) updates.config = body.config;

      const [updated] = await db
        .update(pluginTable)
        .set(updates)
        .where(eq(pluginTable.id, params.id))
        .returning();

      logger.info("Plugin updated", {
        organizationId,
        pluginId: params.id,
        updates: Object.keys(updates),
      });

      return updated;
    },
    {
      body: t.Object({
        isEnabled: t.Optional(t.Boolean()),
        config: t.Optional(t.Any()),
      }),
    },
  )
  /**
   * Delete a plugin from the organization.
   * DELETE /api/v1/plugins/:id
   */
  .delete("/:id", async ({ params, headers, status }) => {
    const authInfo = await resolveAuth(headers.authorization);
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    // Verify Warden authorization (admin required for delete)
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

    const existing = await db.query.pluginTable.findFirst({
      where: and(
        eq(pluginTable.id, params.id),
        eq(pluginTable.organizationId, organizationId),
      ),
    });

    if (!existing) return status(404, { error: "Plugin not found" });

    // Delete from S3 if configured
    if (PLUGIN_STORAGE_BUCKET) {
      const url = new URL(existing.wasmUrl);
      const key = url.pathname.replace(/^\//, "");

      await s3
        .send(
          new DeleteObjectCommand({
            Bucket: PLUGIN_STORAGE_BUCKET,
            Key: key,
          }),
        )
        .catch((err) => {
          logger.error("Failed to delete plugin WASM from S3", {
            pluginId: params.id,
            key,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }

    await db.delete(pluginTable).where(eq(pluginTable.id, params.id));

    logger.info("Plugin deleted", {
      organizationId,
      pluginId: params.id,
    });

    return { success: true };
  })
  /**
   * Verify a plugin (admin: set isVerified=true).
   * POST /api/v1/plugins/:id/verify
   */
  .post("/:id/verify", async ({ params, headers, status }) => {
    const authInfo = await resolveAuth(headers.authorization);
    if (!authInfo)
      return status(401, { error: "Invalid or missing credentials" });

    const { organizationId } = authInfo;

    // Verify Warden authorization (admin required for verify)
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

    const existing = await db.query.pluginTable.findFirst({
      where: eq(pluginTable.id, params.id),
    });

    if (!existing) return status(404, { error: "Plugin not found" });

    if (existing.organizationId !== organizationId) {
      return status(403, { error: "Not authorized to verify this plugin" });
    }

    const [updated] = await db
      .update(pluginTable)
      .set({ isVerified: true })
      .where(eq(pluginTable.id, params.id))
      .returning();

    logger.info("Plugin verified", {
      pluginId: params.id,
      organizationId: existing.organizationId,
    });

    return updated;
  });

export default pluginRoutes;
