/**
 * Organization-membership reconciler - self-healing safety net for authz drift.
 *
 * Vortex mirrors Gatekeeper's organization memberships into its own
 * `user_organization` table (synced via IDP webhooks) and writes a Warden (PDP)
 * membership tuple on every change. A sync can be missed (transient failure, a
 * code path that skips the hook, a row created before sync existed), and because
 * product APIs rely entirely on Warden tuples for access decisions, a missed
 * tuple silently locks a member out with no error anywhere.
 *
 * This reconciler periodically diffs vortex's `user_organization` view against
 * the organization-membership tuples in Warden and writes any that are missing.
 * It is add-only: it never deletes tuples (live role-change and removal paths
 * own deletions), so it can only ever restore access, never revoke it.
 *
 * Overlap with Gatekeeper: gatekeeper-app authoritatively reconciles the same
 * org-membership tuple space from its own `member` table. This vortex reconciler
 * is a redundant ADD-ONLY safety net over that same space, built from vortex's
 * replicated `user_organization` view. Because both are add-only and idempotent,
 * they cannot conflict: writing an existing tuple is a no-op.
 *
 * CRITICAL identifier note: vortex writes membership tuples keyed on the
 * Gatekeeper IDP user id (`user:${idpUserId}`), but `user_organization.userId`
 * is vortex's own local uuid. Expected tuples MUST be built from the user's
 * `identity_provider_id`, reached by joining `user_organization` to `user`
 * (mirroring `src/scripts/authz/reconcile.ts`), or the tuples never match the
 * PDP and get rewritten forever.
 */

import { sql } from "drizzle-orm";

import {
  AUTHZ_API_URL,
  AUTHZ_SERVICE_KEY,
  DATABASE_URL,
  isAuthzEnabled,
} from "lib/config/env.config";
import { dbPool } from "lib/db/db";
import { writeTuples } from "./client";

/** How often to reconcile membership tuples */
const RECONCILE_INTERVAL_MS = 15 * 60 * 1000;

/** Delay before the first reconcile so it does not race boot/migrations */
const INITIAL_DELAY_MS = 60_000;

/** Request timeout for PDP reads */
const REQUEST_TIMEOUT_MS = 10_000;

/** Max tuples per page when reading from the PDP (OpenFGA caps this at 100) */
const PDP_PAGE_SIZE = 100;

/** Max tuples per write transaction (OpenFGA caps this at 100) */
const BATCH_SIZE = 100;

/** Roles that constitute an organization-membership tuple */
const MEMBERSHIP_ROLES = ["owner", "admin", "member"] as const;

interface Tuple {
  user: string;
  relation: string;
  object: string;
}

/** A membership row after the join to Gatekeeper's IDP user id */
interface Membership {
  idpUserId: string;
  role: string;
  organizationId: string;
}

let reconcileTimer: ReturnType<typeof setInterval> | null = null;
/** Guard against overlapping runs if one reconcile outlasts the interval */
let running = false;

const tupleKey = (t: Tuple) => `${t.user}|${t.relation}|${t.object}`;

/**
 * Build the org-membership tuples a set of joined memberships expects, one
 * tuple per row keyed on the IDP user id. Pure and testable.
 *
 * Mirrors `src/scripts/authz/reconcile.ts` exactly: one tuple per row as-is (no
 * role-precedence collapse), so the periodic reconciler and the manual script
 * agree on the expected set.
 */
export function expectedTuplesFromMemberships(
  memberships: Membership[],
): Tuple[] {
  return memberships.map((membership) => ({
    user: `user:${membership.idpUserId}`,
    relation: membership.role,
    object: `organization:${membership.organizationId}`,
  }));
}

/**
 * Return the expected tuples that are absent from the actual set. Pure and
 * testable.
 */
export function missingTuples(expected: Tuple[], actual: Tuple[]): Tuple[] {
  const actualKeys = new Set(actual.map(tupleKey));
  return expected.filter((t) => !actualKeys.has(tupleKey(t)));
}

/**
 * Build the set of organization-membership tuples the `user_organization` view
 * expects. Reuses the manual reconcile script's join so the local uuid is
 * mapped to the Gatekeeper IDP user id the PDP tuples are keyed on.
 */
async function buildExpectedTuples(): Promise<Tuple[]> {
  const memberships = await dbPool.execute<{
    idp_user_id: string;
    organization_id: string;
    role: string;
  }>(sql`
    SELECT u.identity_provider_id AS idp_user_id,
           uo.organization_id,
           uo.role
    FROM user_organization uo
    JOIN "user" u ON u.id = uo.user_id
  `);

  return expectedTuplesFromMemberships(
    memberships.rows.map((m) => ({
      idpUserId: m.idp_user_id,
      role: m.role,
      organizationId: m.organization_id,
    })),
  );
}

/**
 * Fetch all organization-membership tuples currently in the PDP. Filter matches
 * the manual reconcile script.
 */
async function fetchActualTuples(): Promise<Tuple[]> {
  const tuples: Tuple[] = [];
  let continuationToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: String(PDP_PAGE_SIZE) });
    if (continuationToken) params.set("continuationToken", continuationToken);

    const response = await fetch(
      `${AUTHZ_API_URL}/tuples?${params.toString()}`,
      {
        headers: {
          ...(AUTHZ_SERVICE_KEY && { "X-Service-Key": AUTHZ_SERVICE_KEY }),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tuples: ${response.status}`);
    }

    const data = (await response.json()) as {
      tuples: Tuple[];
      continuationToken?: string;
    };

    for (const tuple of data.tuples) {
      if (
        tuple.object.startsWith("organization:") &&
        tuple.user.startsWith("user:") &&
        (MEMBERSHIP_ROLES as readonly string[]).includes(tuple.relation)
      ) {
        tuples.push(tuple);
      }
    }

    continuationToken = data.continuationToken;
  } while (continuationToken);

  return tuples;
}

/**
 * Run a single reconcile pass: write any expected membership tuples missing from
 * the PDP. Returns a summary for observability.
 * @knipignore Exported for testability and manual-reconcile parity
 */
export async function reconcileMembershipTuples(): Promise<{
  expected: number;
  actual: number;
  repaired: number;
}> {
  const expected = await buildExpectedTuples();
  const actual = await fetchActualTuples();

  const missing = missingTuples(expected, actual);

  if (missing.length > 0) {
    // Chunk writes: OpenFGA caps a write transaction at 100 tuples and the
    // provider POSTs a batch as one request, so a large drift event would be
    // rejected wholesale and repair nothing. Keep going past a failed batch so a
    // partial outage still repairs what it can
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      try {
        await writeTuples(AUTHZ_API_URL as string, batch);
      } catch (error) {
        console.error(
          JSON.stringify({
            type: "warden_vortex_reconcile_error",
            error: error instanceof Error ? error.message : String(error),
            batchStart: i,
            batchSize: batch.length,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }

    console.warn(
      JSON.stringify({
        type: "warden_vortex_reconcile",
        expected: expected.length,
        actual: actual.length,
        repaired: missing.length,
        repairedTuples: missing.map(
          (t) => `${t.user}#${t.relation}@${t.object}`,
        ),
        timestamp: new Date().toISOString(),
      }),
    );
  } else {
    // Heartbeat: always log a clean pass so "ran, 0 drift" is observable and
    // never confused with "never ran" (silent success hid the original bug)
    console.info(
      JSON.stringify({
        type: "warden_vortex_reconcile",
        expected: expected.length,
        actual: actual.length,
        repaired: 0,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  return {
    expected: expected.length,
    actual: actual.length,
    repaired: missing.length,
  };
}

async function reconcile(): Promise<void> {
  if (!AUTHZ_API_URL || !DATABASE_URL) return;
  if (running) return;

  running = true;
  try {
    await reconcileMembershipTuples();
  } catch (error) {
    console.error(
      "[warden-reconcile] Reconcile error:",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    running = false;
  }
}

/**
 * Start the background organization-membership reconciler.
 * Safe to call multiple times; only one reconciler runs at a time.
 */
export function startWardenReconciler(): void {
  if (reconcileTimer) return;
  if (!isAuthzEnabled) return;

  // .unref() so the interval does not keep the process alive during shutdown
  reconcileTimer = setInterval(reconcile, RECONCILE_INTERVAL_MS).unref();

  // Delay the first pass so it does not race boot/migrations
  setTimeout(reconcile, INITIAL_DELAY_MS).unref();

  console.info(
    `[warden-reconcile] Reconciler started (interval: ${RECONCILE_INTERVAL_MS}ms)`,
  );
}

/**
 * Stop the background organization-membership reconciler.
 */
export function stopWardenReconciler(): void {
  if (!reconcileTimer) return;

  clearInterval(reconcileTimer);
  reconcileTimer = null;

  console.info("[warden-reconcile] Reconciler stopped");
}
