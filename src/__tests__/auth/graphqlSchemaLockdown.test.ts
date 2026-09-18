/**
 * GraphQL schema lockdown tests (P0-3 / P0-4).
 *
 * Asserts against the committed SDL (which feeds client codegen and mirrors the
 * schema the server builds at boot from `graphileBasePreset`) that the
 * dangerous auto-generated surface is gone:
 *
 * - no `user_organization` CUD (org-membership / role escalation)
 * - no `user` CUD or root-query PII enumeration (account takeover)
 * - no OAuth token CUD, and the encrypted token secrets are not selectable
 * - no `<type>ById` nodeId mutation variants (the unguarded parallel path)
 * - no mutations for the internal/system tables
 * - only the seven guarded entities keep their primary-key CUD mutations
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SDL = readFileSync(
  join(import.meta.dirname, "..", "..", "generated/graphql/schema.graphql"),
  "utf-8",
);

const fieldNames = (typeName: string): string[] => {
  // The type may declare interfaces, e.g. `type Query implements Node {`
  const start = SDL.indexOf(`type ${typeName} `);
  if (start === -1) return [];
  const brace = SDL.indexOf("{", start);
  const end = SDL.indexOf("\n}", brace);
  const block = SDL.slice(brace, end);
  // Field lines are two-space indented and end in either `(` (has args) or `:`
  return [...block.matchAll(/^ {2}([a-zA-Z]+)[(:]/gm)].map((m) => m[1]);
};

const mutations = fieldNames("Mutation");
const queries = fieldNames("Query");

describe("mutation surface is locked down", () => {
  it("exposes only the guarded entity CUD mutations plus publishEvent", () => {
    expect([...mutations].sort()).toEqual(
      [
        "createEventRoutingRule",
        "createEventSchema",
        "createEventSubscription",
        "createIntegration",
        "createMcpServer",
        "createPlugin",
        "createWorkflow",
        "deleteEventRoutingRule",
        "deleteEventSchema",
        "deleteEventSubscription",
        "deleteIntegration",
        "deleteMcpServer",
        "deletePlugin",
        "deleteWorkflow",
        "publishEvent",
        "updateEventRoutingRule",
        "updateEventSchema",
        "updateEventSubscription",
        "updateIntegration",
        "updateMcpServer",
        "updatePlugin",
        "updateWorkflow",
      ].sort(),
    );
  });

  it("removes all organization-membership mutations (role escalation)", () => {
    expect(mutations.filter((m) => /UserOrganization/i.test(m))).toEqual([]);
  });

  it("removes all user mutations (account takeover)", () => {
    expect(mutations.filter((m) => /User$|UserBy|UserById/i.test(m))).toEqual(
      [],
    );
  });

  it("removes all OAuth token / state mutations", () => {
    expect(mutations.filter((m) => /Oauth/i.test(m))).toEqual([]);
  });

  it("removes every nodeId-based *ById mutation variant", () => {
    expect(mutations.filter((m) => m.endsWith("ById"))).toEqual([]);
  });

  it("removes mutations for internal/system tables", () => {
    const internal =
      /EventLog|SagaRun|SagaStepLog|WorkflowRun|WorkflowVersion|WorkflowStepLog|Outbox|WardenSyncQueue|ApprovalRequest|RivetGraph|SubscriptionDelivery|PluginUsage|PluginMarketplace|EmailSuppression|WorkflowExecutorConfig|WorkflowTemplate|IntegrationDefinition|DeadLetterEvent|^createFn|Fn$/;
    expect(mutations.filter((m) => internal.test(m))).toEqual([]);
  });
});

describe("read surface no longer leaks PII / secrets", () => {
  it("removes user and outbox root query entry points", () => {
    expect(
      queries.filter((q) => /^user(By|s|ById)?$|^outbox/i.test(q)),
    ).toEqual([]);
  });

  it("keeps organization-membership queries (scoped at runtime)", () => {
    expect(queries).toContain("userOrganizations");
  });

  it("keeps the Relay node field (scoped at runtime)", () => {
    expect(queries).toContain("node");
  });

  it("never exposes the encrypted OAuth access/refresh tokens", () => {
    expect(SDL).not.toContain("accessToken");
    expect(SDL).not.toContain("refreshToken");
  });
});
