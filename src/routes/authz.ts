import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { AUTHZ_API_URL, AUTHZ_SERVICE_KEY } from "lib/config/env.config";
import { dbPool as db } from "lib/db/db";
import { userOrganizationTable, userTable } from "lib/db/schema";
import logger from "lib/logger";
import { deleteTuples, writeTuples } from "lib/warden/client";

interface TupleKey {
  user: string;
  relation: string;
  object: string;
}

/** Request timeout for PDP calls */
const REQUEST_TIMEOUT_MS = 10_000;

/** Max tuples per page when reading from PDP */
const PDP_PAGE_SIZE = 200;

/** Max tuples per write batch */
const BATCH_SIZE = 100;

/**
 * Build expected user-organization membership tuples from the DB.
 */
async function buildExpectedTuples(): Promise<TupleKey[]> {
  const memberships = await db
    .select({
      idpUserId: userTable.identityProviderId,
      organizationId: userOrganizationTable.organizationId,
      role: userOrganizationTable.role,
    })
    .from(userOrganizationTable)
    .innerJoin(userTable, eq(userTable.id, userOrganizationTable.userId));

  return memberships.map((m) => ({
    user: `user:${m.idpUserId}`,
    relation: m.role,
    object: `organization:${m.organizationId}`,
  }));
}

/**
 * Fetch all organization membership tuples from the PDP with pagination.
 * Filters to user->organization membership tuples only.
 */
async function fetchOrgTuplesFromPDP(): Promise<TupleKey[]> {
  if (!AUTHZ_API_URL || !AUTHZ_SERVICE_KEY) {
    throw new Error("AUTHZ_API_URL and AUTHZ_SERVICE_KEY required");
  }

  const allTuples: TupleKey[] = [];
  let continuationToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: String(PDP_PAGE_SIZE) });
    if (continuationToken) {
      params.set("continuationToken", continuationToken);
    }

    const response = await fetch(
      `${AUTHZ_API_URL}/tuples?${params.toString()}`,
      {
        headers: { "X-Service-Key": AUTHZ_SERVICE_KEY },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tuples: ${response.status}`);
    }

    const data = (await response.json()) as {
      tuples: TupleKey[];
      continuationToken?: string;
    };

    // Filter to organization membership tuples only
    const orgTuples = data.tuples.filter(
      (tuple) =>
        tuple.object.startsWith("organization:") &&
        tuple.user.startsWith("user:") &&
        ["owner", "admin", "member"].includes(tuple.relation),
    );

    allTuples.push(...orgTuples);
    continuationToken = data.continuationToken;
  } while (continuationToken);

  return allTuples;
}

/**
 * Compare expected vs actual tuples and return drift.
 */
function computeDrift(
  expected: TupleKey[],
  actual: TupleKey[],
): { missing: TupleKey[]; orphaned: TupleKey[] } {
  const key = (t: TupleKey) => `${t.user}|${t.relation}|${t.object}`;
  const expectedKeys = new Set(expected.map(key));
  const actualKeys = new Set(actual.map(key));

  const missing = expected.filter((t) => !actualKeys.has(key(t)));
  const orphaned = actual.filter((t) => !expectedKeys.has(key(t)));

  return { missing, orphaned };
}

/**
 * Authorization drift detection and reconciliation routes.
 *
 * Used by Hatchet cron workflows and manual ops to detect and repair
 * user-organization membership tuple drift between the DB and PDP (Warden).
 */
const authzRoutes = new Elysia({ prefix: "/authz" })
  /**
   * List expected user-organization membership tuples from the DB.
   * GET /api/v1/authz/tuples
   */
  .get(
    "/tuples",
    async ({ headers, set }) => {
      const serviceKey = headers["x-service-key"];
      if (!serviceKey || serviceKey !== AUTHZ_SERVICE_KEY) {
        set.status = 401;
        return { error: "Invalid or missing service key" };
      }

      const tuples = await buildExpectedTuples();

      return {
        tuples,
        count: tuples.length,
      };
    },
    {
      headers: t.Object({
        "x-service-key": t.Optional(t.String()),
      }),
    },
  )

  /**
   * Compare DB tuples vs PDP tuples and return a drift report.
   * GET /api/v1/authz/drift
   */
  .get(
    "/drift",
    async ({ headers, set }) => {
      const serviceKey = headers["x-service-key"];
      if (!serviceKey || serviceKey !== AUTHZ_SERVICE_KEY) {
        set.status = 401;
        return { error: "Invalid or missing service key" };
      }

      if (!AUTHZ_API_URL) {
        set.status = 400;
        return { error: "AuthZ is disabled or not configured" };
      }

      const expectedTuples = await buildExpectedTuples();
      const actualTuples = await fetchOrgTuplesFromPDP();
      const { missing, orphaned } = computeDrift(expectedTuples, actualTuples);

      return {
        expected: expectedTuples.length,
        actual: actualTuples.length,
        missing: missing.length,
        orphaned: orphaned.length,
        missingTuples: missing,
        orphanedTuples: orphaned,
      };
    },
    {
      headers: t.Object({
        "x-service-key": t.Optional(t.String()),
      }),
    },
  )

  /**
   * Write missing tuples and optionally delete orphaned ones.
   * POST /api/v1/authz/reconcile
   */
  .post(
    "/reconcile",
    async ({ headers, body, set }) => {
      const serviceKey = headers["x-service-key"];
      if (!serviceKey || serviceKey !== AUTHZ_SERVICE_KEY) {
        set.status = 401;
        return { error: "Invalid or missing service key" };
      }

      if (!AUTHZ_API_URL) {
        set.status = 400;
        return { error: "AuthZ is disabled or not configured" };
      }

      const deleteOrphans = body?.deleteOrphans ?? false;
      const dryRun = body?.dryRun ?? false;

      // Build expected tuples from DB
      const expectedTuples = await buildExpectedTuples();

      // Fetch actual tuples from PDP
      const actualTuples = await fetchOrgTuplesFromPDP();

      // Compute drift
      const { missing, orphaned } = computeDrift(expectedTuples, actualTuples);

      const results = {
        written: 0,
        deleted: 0,
        errors: [] as string[],
      };

      if (dryRun) {
        return {
          ...results,
          written: missing.length,
          deleted: deleteOrphans ? orphaned.length : 0,
          dryRun: true,
        };
      }

      // Write missing tuples in batches
      if (missing.length > 0) {
        for (let i = 0; i < missing.length; i += BATCH_SIZE) {
          const batch = missing.slice(i, i + BATCH_SIZE);
          try {
            await writeTuples(AUTHZ_API_URL, batch);
            results.written += batch.length;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.errors.push(
              `Write batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${msg}`,
            );
            logger.error("Authz reconcile write failed", {
              batch: Math.floor(i / BATCH_SIZE) + 1,
              error: msg,
            });
          }
        }
      }

      // Delete orphaned tuples if requested
      if (deleteOrphans && orphaned.length > 0) {
        for (let i = 0; i < orphaned.length; i += BATCH_SIZE) {
          const batch = orphaned.slice(i, i + BATCH_SIZE);
          try {
            await deleteTuples(AUTHZ_API_URL, batch);
            results.deleted += batch.length;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.errors.push(
              `Delete batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${msg}`,
            );
            logger.error("Authz reconcile delete failed", {
              batch: Math.floor(i / BATCH_SIZE) + 1,
              error: msg,
            });
          }
        }
      }

      logger.info("Authz reconciliation completed", {
        written: results.written,
        deleted: results.deleted,
        errors: results.errors.length,
      });

      return results;
    },
    {
      headers: t.Object({
        "x-service-key": t.Optional(t.String()),
      }),
      body: t.Optional(
        t.Object({
          deleteOrphans: t.Optional(t.Boolean()),
          dryRun: t.Optional(t.Boolean()),
        }),
      ),
    },
  );

export default authzRoutes;
