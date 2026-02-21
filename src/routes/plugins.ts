import { createHash } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Elysia, t } from "elysia";

import validateApiKey from "lib/auth/apiKey";
import {
  PLUGIN_STORAGE_BASE_URL,
  PLUGIN_STORAGE_BUCKET,
} from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { pluginTable } from "lib/db/schema";
import logger from "lib/logger";

const s3 = new S3Client({});

/**
 * Plugin marketplace routes.
 *
 * Provides WASM plugin upload and management endpoints.
 */
const pluginRoutes = new Elysia({ prefix: "/plugins" })
  /**
   * Upload a WASM plugin to the marketplace.
   * POST /api/v1/plugins/upload
   */
  .post(
    "/upload",
    async ({ body, headers, status }) => {
      // Auth: require Bearer token (same pattern as other /api/v1/ routes)
      const apiKeyInfo = await validateApiKey(headers.authorization);

      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;

      // Check plugin storage is configured
      if (!PLUGIN_STORAGE_BUCKET) {
        return status(501, {
          error: "Plugin storage not configured — set PLUGIN_STORAGE_BUCKET",
        });
      }

      const bucket = PLUGIN_STORAGE_BUCKET;

      try {
        // Extract WASM bytes and compute SHA256
        const wasmBuffer = Buffer.from(await body.wasm.arrayBuffer());
        const sha256 = createHash("sha256").update(wasmBuffer).digest("hex");

        // Parse manifest JSON
        let manifest: Record<string, unknown>;
        try {
          manifest = JSON.parse(body.manifest) as Record<string, unknown>;
        } catch {
          return status(400, { error: "Invalid manifest JSON" });
        }

        // Reject if manifest.wasm is pre-populated (reserved field)
        if (manifest.wasm !== undefined) {
          return status(400, {
            error:
              "manifest.wasm is reserved — omit it from the upload payload",
          });
        }

        // Upload WASM to S3
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

        // Inject wasm.url into manifest
        manifest.wasm = { url: wasmUrl };

        // Insert plugin record
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
  );

export default pluginRoutes;
