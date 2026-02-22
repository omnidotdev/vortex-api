import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { zipSync } from "fflate";

import validateApiKey from "lib/auth/apiKey";
import { dbPool as db } from "lib/db/db";
import { workflowTable } from "lib/db/schema";
import logger from "lib/logger";

/**
 * Workflow export routes.
 *
 * Provides workflow export endpoints (e.g., WASM/CF Workers deployment bundle).
 */
const workflowRoutes = new Elysia({ prefix: "/workflows" })
  /**
   * Export a workflow as a Cloudflare Workers deployment bundle.
   * POST /api/v1/workflows/:workflowId/export/wasm
   */
  .post(
    "/:workflowId/export/wasm",
    async ({ params, headers, status }) => {
      const apiKeyInfo = await validateApiKey(headers.authorization);
      if (!apiKeyInfo) {
        return status(401, { error: "Invalid or missing API key" });
      }

      const { organizationId } = apiKeyInfo;
      const { workflowId } = params;

      const workflow = await db.query.workflowTable.findFirst({
        where: and(
          eq(workflowTable.id, workflowId),
          eq(workflowTable.organizationId, organizationId),
        ),
      });

      if (!workflow) {
        return status(404, { error: "Workflow not found" });
      }

      try {
        const wranglerToml = [
          `name = "vortex-edge-${workflowId}"`,
          `main = "worker.js"`,
          `compatibility_date = "2025-01-01"`,
          `compatibility_flags = ["nodejs_compat"]`,
          ``,
          `[vars]`,
          `WORKFLOW_ID = "${workflowId}"`,
          `VORTEX_ORIGIN = ""`,
        ].join("\n");

        const readme = [
          `# Deploy Vortex Edge Worker`,
          ``,
          `1. Install Wrangler: npm install -g wrangler`,
          `2. Edit wrangler.toml to set VORTEX_ORIGIN`,
          `3. Deploy: wrangler deploy`,
        ].join("\n");

        const encoder = new TextEncoder();

        const zipBuffer = zipSync({
          "workflow.json": encoder.encode(
            JSON.stringify(workflow.definition, null, 2),
          ),
          "wrangler.toml": encoder.encode(wranglerToml),
          "README.md": encoder.encode(readme),
        });

        logger.info("Workflow exported as WASM bundle", {
          organizationId,
          workflowId,
        });

        return new Response(Buffer.from(zipBuffer), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="vortex-edge-${workflowId}.zip"`,
          },
        });
      } catch (err) {
        logger.error("Workflow WASM export failed", {
          workflowId,
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to export workflow" });
      }
    },
    {
      params: t.Object({
        workflowId: t.String(),
      }),
    },
  );

export default workflowRoutes;
