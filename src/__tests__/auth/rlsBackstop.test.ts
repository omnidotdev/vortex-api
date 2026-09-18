/**
 * RLS backstop tests (P0-3 c).
 *
 * A generated migration must enable row-level security and an
 * organization-scoping policy on every tenant table, so that a restricted
 * database role (infra follow-up) cannot read across organizations even if the
 * application-level scoping is ever bypassed.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "generated/drizzle",
);

const allMigrationsSql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8"))
  .join("\n");

/** Tenant tables that carry an organization_id and must be RLS-scoped. */
const ORG_SCOPED_TABLES = [
  "approval_request",
  "dead_letter_event",
  "event_log",
  "event_routing_rule",
  "event_schema",
  "event_subscription",
  "fn",
  "integration",
  "mcp_server",
  "oauth_state",
  "oauth_token",
  "plugin",
  "plugin_usage",
  "rivet_graph",
  "saga_run",
  "subscription_delivery",
  "user_organization",
  "workflow",
  "workflow_executor_config",
];

describe("RLS backstop migration", () => {
  for (const table of ORG_SCOPED_TABLES) {
    it(`enables row level security on ${table}`, () => {
      expect(allMigrationsSql).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
    });

    it(`adds an organization-scoping policy on ${table}`, () => {
      expect(allMigrationsSql).toContain(
        `CREATE POLICY "organization_isolation" ON "${table}"`,
      );
    });
  }

  it("scopes the policy on the app.organization_ids session setting", () => {
    expect(allMigrationsSql).toContain(
      "organization_id = ANY(coalesce(nullif(current_setting('app.organization_ids', true), ''), '{}')::text[])",
    );
  });
});
