/**
 * @file Run database migrations on boot via the shared resilient runner.
 *
 * Uses `@omnidotdev/providers/db` `runMigrations`, which self-heals migration
 * tracker drift (reconciles already-applied migrations instead of hard-failing
 * on a re-applied non-idempotent statement such as `CREATE POLICY ... already
 * exists`). This replaces the former bespoke migrate.ts + repairMigrations.ts
 * pair: the reconcile is now built into the shared runner.
 */

import { runMigrations } from "@omnidotdev/providers/db";

try {
  await runMigrations();
} catch (err) {
  console.error("[Migrate] Migration failed:", err);
  process.exit(1);
}
