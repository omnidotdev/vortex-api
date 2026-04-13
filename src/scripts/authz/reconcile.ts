/**
 * Reconcile user-organization membership tuples in OpenFGA (Warden).
 *
 * After a Fractal cluster migration, the OpenFGA store is empty. This script
 * reads all user-organization memberships from the local DB (synced from
 * Gatekeeper via IDP webhooks) and writes the corresponding authorization
 * tuples to the Warden PDP.
 *
 * Usage:
 *   bun authz:reconcile                   # Write missing tuples
 *   bun authz:reconcile --delete-orphans  # Also delete orphaned tuples
 *   bun authz:reconcile --dry-run         # Show what would be done
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

const { DATABASE_URL, AUTHZ_API_URL, AUTHZ_SERVICE_KEY } = process.env;

const BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 10_000;
const PDP_PAGE_SIZE = 200;

const deleteOrphans = process.argv.includes("--delete-orphans");
const dryRun = process.argv.includes("--dry-run");

interface TupleKey {
  user: string;
  relation: string;
  object: string;
}

/**
 * Fetch all organization membership tuples from PDP with pagination.
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
      (t) =>
        t.object.startsWith("organization:") &&
        t.user.startsWith("user:") &&
        ["owner", "admin", "member"].includes(t.relation),
    );

    allTuples.push(...orgTuples);
    continuationToken = data.continuationToken;
  } while (continuationToken);

  return allTuples;
}

/**
 * Write tuples to PDP in batches.
 */
async function writeTuplesBatch(tuples: TupleKey[]): Promise<number> {
  if (!AUTHZ_API_URL || !AUTHZ_SERVICE_KEY) return 0;

  let written = 0;

  for (let i = 0; i < tuples.length; i += BATCH_SIZE) {
    const batch = tuples.slice(i, i + BATCH_SIZE);

    const response = await fetch(`${AUTHZ_API_URL}/tuples`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": AUTHZ_SERVICE_KEY,
      },
      body: JSON.stringify({ tuples: batch }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `Failed to write batch ${i / BATCH_SIZE + 1}: ${response.status} ${text}`,
      );
      continue;
    }

    written += batch.length;
    console.log(
      `  Wrote batch ${i / BATCH_SIZE + 1}: ${batch.length} tuples`,
    );
  }

  return written;
}

/**
 * Delete tuples from PDP in batches.
 */
async function deleteTuplesBatch(tuples: TupleKey[]): Promise<number> {
  if (!AUTHZ_API_URL || !AUTHZ_SERVICE_KEY) return 0;

  let deleted = 0;

  for (let i = 0; i < tuples.length; i += BATCH_SIZE) {
    const batch = tuples.slice(i, i + BATCH_SIZE);

    const response = await fetch(`${AUTHZ_API_URL}/tuples`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": AUTHZ_SERVICE_KEY,
      },
      body: JSON.stringify({ tuples: batch }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `Failed to delete batch ${i / BATCH_SIZE + 1}: ${response.status} ${text}`,
      );
      continue;
    }

    deleted += batch.length;
  }

  return deleted;
}

async function reconcile() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is not defined");
    process.exit(1);
  }

  if (!AUTHZ_API_URL) {
    console.error("AUTHZ_API_URL is not defined");
    process.exit(1);
  }

  console.log(
    `Reconciling user-organization tuples with Warden PDP...${dryRun ? " (dry run)" : ""}\n`,
  );

  // Connect to DB and query all user-organization memberships
  const db = drizzle(DATABASE_URL, { casing: "snake_case" });

  const memberships = await db.execute<{
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

  console.log(`Found ${memberships.rows.length} memberships in DB`);

  // Build expected tuples
  const expectedTuples: TupleKey[] = memberships.rows.map((m) => ({
    user: `user:${m.idp_user_id}`,
    relation: m.role,
    object: `organization:${m.organization_id}`,
  }));

  // Fetch actual tuples from PDP
  let actualTuples: TupleKey[] = [];
  try {
    actualTuples = await fetchOrgTuplesFromPDP();
  } catch (error) {
    console.warn(
      `Could not fetch existing tuples from PDP: ${error instanceof Error ? error.message : error}`,
    );
    console.log("Proceeding with full write (idempotent)\n");
  }

  // Compare
  const tupleKey = (t: TupleKey) => `${t.user}|${t.relation}|${t.object}`;
  const actualKeys = new Set(actualTuples.map(tupleKey));
  const expectedKeys = new Set(expectedTuples.map(tupleKey));

  const missingTuples = expectedTuples.filter(
    (t) => !actualKeys.has(tupleKey(t)),
  );
  const orphanedTuples = actualTuples.filter(
    (t) => !expectedKeys.has(tupleKey(t)),
  );

  console.log(
    `Expected: ${expectedTuples.length}, In PDP: ${actualTuples.length}`,
  );
  console.log(
    `Missing: ${missingTuples.length}, Orphaned: ${orphanedTuples.length}\n`,
  );

  if (missingTuples.length === 0 && orphanedTuples.length === 0) {
    console.log("No drift detected, PDP is in sync");
    process.exit(0);
  }

  // Write missing tuples
  if (missingTuples.length > 0) {
    if (dryRun) {
      console.log(`Would write ${missingTuples.length} tuples:`);
      for (const t of missingTuples.slice(0, 10)) {
        console.log(`  ${t.user} -> ${t.relation} -> ${t.object}`);
      }
      if (missingTuples.length > 10) {
        console.log(`  ... and ${missingTuples.length - 10} more`);
      }
    } else {
      console.log(`Writing ${missingTuples.length} missing tuples...`);
      const written = await writeTuplesBatch(missingTuples);
      console.log(`Wrote ${written} tuples\n`);
    }
  }

  // Delete orphaned tuples
  if (orphanedTuples.length > 0 && deleteOrphans) {
    if (dryRun) {
      console.log(`Would delete ${orphanedTuples.length} orphaned tuples:`);
      for (const t of orphanedTuples.slice(0, 10)) {
        console.log(`  ${t.user} -> ${t.relation} -> ${t.object}`);
      }
    } else {
      console.log(`Deleting ${orphanedTuples.length} orphaned tuples...`);
      const deleted = await deleteTuplesBatch(orphanedTuples);
      console.log(`Deleted ${deleted} tuples\n`);
    }
  } else if (orphanedTuples.length > 0) {
    console.log(
      `Skipping ${orphanedTuples.length} orphaned tuples (use --delete-orphans to remove)`,
    );
  }

  console.log("Reconciliation complete");
}

reconcile().catch((error) => {
  console.error("Reconciliation failed:", error);
  process.exit(1);
});
