/**
 * OrganizationScope fail-closed and coverage tests (P0-4).
 *
 * `scopeSingleItem` / `scopeChildSingleItem` used to early-return whenever the
 * observer was null, which - combined with the old fail-open auth gate - let an
 * unauthenticated caller read a single org-scoped row. Enforcement must not be
 * gated on the observer. Also verifies the polymorphic Relay `node(id)` lookup
 * and organization-membership queries are now scoped.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(
    import.meta.dirname,
    "..",
    "..",
    "lib/graphql/plugins/authorization/OrganizationScope.plugin.ts",
  ),
  "utf-8",
);

describe("OrganizationScope no longer skips enforcement on a null observer", () => {
  it("removed the `if (!item || !observer) return` fail-open guard", () => {
    expect(source).not.toContain("if (!item || !observer) return");
  });

  it("single-item scoping no longer reads the observer at all", () => {
    // The single-item guards now rely solely on organizationIds, which is
    // absent for anonymous requests, so they fail closed
    const single = source.slice(source.indexOf("const scopeSingleItem"));
    expect(single).not.toContain('context().get("observer")');
  });
});

describe("OrganizationScope covers the cross-tenant read vectors", () => {
  it("scopes the Relay node(id) lookup", () => {
    expect(source).toMatch(/node:\s*scopeSingleItem\(\)/);
  });

  it("scopes organization membership queries", () => {
    expect(source).toMatch(/userOrganizations:\s*scopeCollection\(\)/);
    expect(source).toMatch(/userOrganization:\s*scopeSingleItem\(\)/);
    expect(source).toMatch(/userOrganizationById:\s*scopeSingleItem\(\)/);
  });
});
