import { and, count, desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { VORTEX_PUBLIC_URL } from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { fnTable } from "lib/db/schema";
import { FEATURE_KEYS } from "lib/entitlements/constants";
import { getPlanLimit } from "lib/entitlements/enforce";
import { isConfigured, pushEvent } from "lib/hatchet/client";
import logger from "lib/logger";
import authorize from "lib/warden/authorize";

/**
 * Build the public invocation URL for a registered function.
 */
const buildInvokeUrl = (fnId: string): string => {
  const base = VORTEX_PUBLIC_URL ?? "http://localhost:4222";
  return `${base}/api/v1/functions/${fnId}/invoke`;
};

/**
 * FaaS function registry and invocation routes.
 *
 * Register functions (inline JS or WASM), list/get/delete them,
 * and invoke via HTTP. Execution is dispatched to the worker
 * service through Hatchet.
 */
const functionRoutes = new Elysia({ prefix: "/functions" })
  /**
   * Register a new function.
   * POST /api/v1/functions
   */
  .post(
    "/",
    async ({ body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (member required for register)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.userId,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      // Enforce function plan limit
      const [fnLimit, existingFns] = await Promise.all([
        getPlanLimit(organizationId, FEATURE_KEYS.MAX_FUNCTIONS),
        db
          .select({ count: count() })
          .from(fnTable)
          .where(eq(fnTable.organizationId, organizationId)),
      ]);

      if (fnLimit !== -1 && (existingFns[0]?.count ?? 0) >= fnLimit) {
        return status(403, {
          error: `Plan limit reached: functions (${existingFns[0]?.count ?? 0}/${fnLimit}). Upgrade your plan to continue.`,
        });
      }

      // Validate runtime-specific fields
      if (body.runtime === "js" && !body.source) {
        return status(400, {
          error: 'Field `source` is required when runtime is "js"',
        });
      }

      if (body.runtime === "wasm" && !body.wasmModuleUrl) {
        return status(400, {
          error: 'Field `wasmModuleUrl` is required when runtime is "wasm"',
        });
      }

      try {
        const [fn] = await db
          .insert(fnTable)
          .values({
            organizationId,
            name: body.name,
            runtime: body.runtime,
            source: body.source,
            wasmModuleUrl: body.wasmModuleUrl,
            executor: body.executor ?? "local",
            limits: body.limits,
            metadata: body.metadata,
          })
          .returning();

        logger.info("Function registered", {
          organizationId,
          fnId: fn.id,
          name: fn.name,
          runtime: fn.runtime,
        });

        return {
          id: fn.id,
          name: fn.name,
          runtime: fn.runtime,
          invokeUrl: buildInvokeUrl(fn.id),
          createdAt: fn.createdAt,
        };
      } catch (err) {
        // Handle unique constraint violation (duplicate name per org)
        if (
          err instanceof Error &&
          err.message.includes("unique_organization_fn_name")
        ) {
          return status(409, {
            error: `Function "${body.name}" already exists in this organization`,
          });
        }

        logger.error("Function registration failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return status(500, { error: "Failed to register function" });
      }
    },
    {
      body: t.Object({
        name: t.String(),
        runtime: t.Union([t.Literal("js"), t.Literal("wasm")]),
        source: t.Optional(t.String()),
        wasmModuleUrl: t.Optional(t.String()),
        executor: t.Optional(
          t.Union([t.Literal("local"), t.Literal("spinkube")]),
        ),
        limits: t.Optional(
          t.Object({
            memoryMb: t.Optional(t.Number()),
            timeoutMs: t.Optional(t.Number()),
            maxOutputBytes: t.Optional(t.Number()),
          }),
        ),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    },
  )
  /**
   * List functions for the organization (paginated).
   * GET /api/v1/functions
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

      const [fns, totalResult] = await Promise.all([
        db
          .select()
          .from(fnTable)
          .where(eq(fnTable.organizationId, organizationId))
          .orderBy(desc(fnTable.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(fnTable)
          .where(eq(fnTable.organizationId, organizationId)),
      ]);

      return {
        nodes: fns.map((fn) => ({
          id: fn.id,
          name: fn.name,
          runtime: fn.runtime,
          executor: fn.executor,
          invocationCount: fn.invocationCount,
          lastInvokedAt: fn.lastInvokedAt,
          invokeUrl: buildInvokeUrl(fn.id),
          createdAt: fn.createdAt,
          updatedAt: fn.updatedAt,
        })),
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
   * Get a single function by ID.
   * GET /api/v1/functions/:id
   */
  .get(
    "/:id",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      const fn = await db.query.fnTable.findFirst({
        where: and(
          eq(fnTable.id, params.id),
          eq(fnTable.organizationId, organizationId),
        ),
      });

      if (!fn) return status(404, { error: "Function not found" });

      return {
        id: fn.id,
        name: fn.name,
        runtime: fn.runtime,
        executor: fn.executor,
        source: fn.source,
        wasmModuleUrl: fn.wasmModuleUrl,
        limits: fn.limits,
        metadata: fn.metadata,
        invocationCount: fn.invocationCount,
        lastInvokedAt: fn.lastInvokedAt,
        invokeUrl: buildInvokeUrl(fn.id),
        createdAt: fn.createdAt,
        updatedAt: fn.updatedAt,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  /**
   * Invoke a function.
   * POST /api/v1/functions/:id/invoke
   *
   * Dispatches a `function:invoke` event to Hatchet so the worker
   * service can execute the function in a sandbox.
   */
  .post(
    "/:id/invoke",
    async ({ params, body, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;
      const { id } = params;

      // Verify Warden authorization (member required for invoke)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.userId,
          "organization",
          organizationId,
          "member",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      const fn = await db.query.fnTable.findFirst({
        where: and(
          eq(fnTable.id, id),
          eq(fnTable.organizationId, organizationId),
        ),
      });

      if (!fn) return status(404, { error: "Function not found" });

      if (!isConfigured()) {
        return status(503, {
          error: "Function execution backend is not configured",
        });
      }

      try {
        // Dispatch to worker via Hatchet event
        await pushEvent("function:invoke", {
          fnId: fn.id,
          organizationId,
          runtime: fn.runtime,
          source: fn.source,
          wasmModuleUrl: fn.wasmModuleUrl,
          executor: fn.executor,
          limits: fn.limits,
          input: body?.input ?? {},
        });

        // Update invocation stats
        await db
          .update(fnTable)
          .set({
            invocationCount: sql`${fnTable.invocationCount} + 1`,
            lastInvokedAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(eq(fnTable.id, id));

        logger.info("Function invocation dispatched", {
          organizationId,
          fnId: id,
          runtime: fn.runtime,
          executor: fn.executor,
        });

        return {
          fnId: fn.id,
          status: "dispatched",
          message: "Function invocation queued for execution",
        };
      } catch (err) {
        logger.error("Function invocation dispatch failed", {
          organizationId,
          fnId: id,
          error: err instanceof Error ? err.message : String(err),
        });

        return status(500, { error: "Failed to dispatch function invocation" });
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Optional(
        t.Object({
          input: t.Optional(t.Record(t.String(), t.Unknown())),
        }),
      ),
    },
  )
  /**
   * Delete a function.
   * DELETE /api/v1/functions/:id
   */
  .delete(
    "/:id",
    async ({ params, headers, status }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo)
        return status(401, { error: "Invalid or missing credentials" });

      const { organizationId } = authInfo;

      // Verify Warden authorization (admin required for delete)
      if (authInfo.userId) {
        const allowed = await authorize(
          authInfo.userId,
          "organization",
          organizationId,
          "admin",
        );
        if (!allowed) {
          return status(403, { error: "Forbidden: insufficient permissions" });
        }
      }

      const fn = await db.query.fnTable.findFirst({
        where: and(
          eq(fnTable.id, params.id),
          eq(fnTable.organizationId, organizationId),
        ),
      });

      if (!fn) return status(404, { error: "Function not found" });

      await db.delete(fnTable).where(eq(fnTable.id, params.id));

      logger.info("Function deleted", {
        organizationId,
        fnId: params.id,
      });

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  );

export default functionRoutes;
