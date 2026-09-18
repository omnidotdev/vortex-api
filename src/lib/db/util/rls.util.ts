import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";

/**
 * Row-level-security predicate scoping a row to the caller's organizations.
 *
 * Mirrors the SQL that `OrganizationScopePlugin` injects into collection
 * queries: a row is visible when its `organization_id` is one of the caller's
 * organizations, read from the `app.organization_ids` session setting that the
 * authentication plugin sets per request (a Postgres array literal such as
 * `{org_a,org_b}`).
 *
 * A NULL setting (never set) means the connection is a trusted system/direct
 * pool caller (webhooks, dispatch, reconcilers, OAuth flows) rather than an
 * authenticated GraphQL request, and is allowed through so those paths keep
 * working. Authenticated requests always set the value (to `{}` when the user
 * belongs to no organization), so they are always constrained by the ANY check.
 */
const ORGANIZATION_SCOPE = sql`current_setting('app.organization_ids', true) IS NULL OR organization_id = ANY(coalesce(nullif(current_setting('app.organization_ids', true), ''), '{}')::text[])`;

/**
 * Attach organization-scoped RLS to a table that has an `organization_id`
 * column. Adding a policy makes Drizzle emit `ENABLE ROW LEVEL SECURITY` for
 * the table, so this doubles as the enablement.
 *
 * This is a defense-in-depth backstop behind the application-level scoping in
 * `OrganizationScopePlugin`. RLS is NOT forced, so it is inert while
 * Postgraphile connects as the table owner (owners bypass unforced RLS); it
 * becomes enforcing once a non-owner database role is introduced for the
 * GraphQL connection (an infra follow-up). It never blocks the owner-role
 * system/direct-pool queries this service also runs.
 */
export const organizationRlsPolicy = () =>
  pgPolicy("organization_isolation", {
    as: "permissive",
    for: "all",
    to: "public",
    using: ORGANIZATION_SCOPE,
    withCheck: ORGANIZATION_SCOPE,
  });
