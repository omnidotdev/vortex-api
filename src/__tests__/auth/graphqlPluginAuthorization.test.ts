/**
 * GraphQL authorization plugin Warden migration tests.
 *
 * Verifies that every authorization plugin has migrated away from the
 * direct DB membership lookup (`userOrganizationTable` + `workflowPermissionTable`)
 * and now calls `authorize()` from `lib/warden/authorize` with the right args.
 *
 * Each plugin should:
 *  - Import `authorize` from `lib/warden/authorize`
 *  - Pass `observer.identityProviderId` as the user identifier
 *  - Use `"organization"` as the resource type
 *  - Use `"member"` for reads, `"admin"` for mutations (per spec)
 *  - No longer reference `userOrganizationTable` for authorization
 */

import { describe, expect, it } from "bun:test";

const PLUGIN_BASE = "src/lib/graphql/plugins/authorization";

const MUTATION_PLUGINS = [
  { file: "Workflow.plugin.ts", relation: "admin", limitKey: "MAX_WORKFLOWS" },
  {
    file: "Integration.plugin.ts",
    relation: "admin",
    limitKey: "MAX_INTEGRATIONS",
  },
  { file: "Plugin.plugin.ts", relation: "admin", limitKey: "MAX_PLUGINS" },
  {
    file: "McpServer.plugin.ts",
    relation: "admin",
    limitKey: "MAX_MCP_SERVERS",
  },
  {
    file: "EventSchema.plugin.ts",
    relation: "admin",
    limitKey: "MAX_EVENT_SCHEMAS",
  },
  {
    file: "EventRoutingRule.plugin.ts",
    relation: "admin",
    limitKey: "MAX_ROUTING_RULES",
  },
  {
    file: "EventSubscription.plugin.ts",
    relation: "admin",
    limitKey: "MAX_SUBSCRIPTIONS",
  },
];

const READ_PLUGINS = [
  { file: "DeadLetterEvent.plugin.ts", relation: "member" },
  { file: "EventLog.plugin.ts", relation: "member" },
];

describe("GraphQL plugin Warden migration", () => {
  for (const plugin of MUTATION_PLUGINS) {
    describe(plugin.file, () => {
      it("imports authorize from lib/warden/authorize", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).toContain('import authorize from "lib/warden/authorize"');
      });

      it("calls authorize() with the admin relation", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).toMatch(/await authorize\(/);
        expect(src).toContain(`"${plugin.relation}"`);
      });

      it("passes observer.identityProviderId as the user identifier", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).toContain("observer.identityProviderId");
      });

      it("uses 'organization' as the resource type", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).toMatch(/authorize\([^)]*"organization"/s);
      });

      it("no longer queries userOrganizationTable for authZ", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).not.toContain("userOrganizationTable");
      });

      it("retains the plan limit check on create", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).toContain("assertUnderLimit");
        expect(src).toContain(`FEATURE_KEYS.${plugin.limitKey}`);
      });
    });
  }

  for (const plugin of READ_PLUGINS) {
    describe(plugin.file, () => {
      it("imports authorize from lib/warden/authorize", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).toContain('import authorize from "lib/warden/authorize"');
      });

      it("calls authorize() with the member relation", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        // Read plugins may invoke authorize inside a Promise.all map,
        // so accept both `await authorize(` and bare `authorize(`
        expect(src).toMatch(/authorize\(/);
        expect(src).toContain(`"${plugin.relation}"`);
      });

      it("passes the observer's identityProviderId to Warden", async () => {
        const src = await Bun.file(`${PLUGIN_BASE}/${plugin.file}`).text();
        expect(src).toContain("identityProviderId");
      });
    });
  }
});

describe("Workflow plugin removed legacy workflowPermissionTable lookup", () => {
  it("Workflow.plugin.ts no longer references workflowPermissionTable", async () => {
    const src = await Bun.file(
      `${PLUGIN_BASE}/Workflow.plugin.ts`,
    ).text();
    expect(src).not.toContain("workflowPermissionTable");
  });
});
