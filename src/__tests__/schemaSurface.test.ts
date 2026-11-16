import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  assertSchemaSurface,
  findTableReadFields,
  listRootFields,
  loadSchema,
} from "@omnidotdev/providers/graphql-surface";

import { ORG_SCOPED_QUERY_FIELDS } from "lib/graphql/plugins/authorization/OrganizationScope.plugin";

import type { SchemaSurfacePolicy } from "@omnidotdev/providers/graphql-surface";

/**
 * Reviewed GraphQL surface.
 *
 * Every root read is wrapped by OrganizationScopePlugin (rows of the caller's
 * organizations, public event schemas) except the shared catalogs listed
 * below. Generated mutations exist only for the entities whose authorization
 * plugin wraps them; internal tables are mutation-locked or removed. The whole
 * API requires authentication
 */
const ADMIN = "org admin+ via the entity's authorization plugin (wrapPlans)";

const schema = loadSchema(
  join(import.meta.dir, "../generated/graphql/schema.graphql"),
);

const scopedReads = Object.fromEntries(
  listRootFields(schema)
    .Query.filter((field) => ORG_SCOPED_QUERY_FIELDS.has(field))
    .map((field) => [
      field,
      "caller's organizations via OrganizationScopePlugin",
    ]),
);

const CATALOG = "shared catalog with no organization data (signed-in)";

const POLICY: SchemaSurfacePolicy = {
  Query: {
    ...scopedReads,
    id: "Relay node id of the root query (no data)",
    pluginMarketplace: CATALOG,
    pluginMarketplaceById: CATALOG,
    pluginMarketplaces: CATALOG,
    workflowTemplate: CATALOG,
    workflowTemplateById: CATALOG,
    workflowTemplates: CATALOG,
    integrationDefinition: CATALOG,
    integrationDefinitionById: CATALOG,
    integrationDefinitions: CATALOG,
  },
  Mutation: {
    ...Object.fromEntries(
      [
        "EventRoutingRule",
        "McpServer",
        "EventSchema",
        "Integration",
        "Plugin",
        "EventSubscription",
      ].flatMap((entity) =>
        ["create", "update", "delete"].map((op) => [`${op}${entity}`, ADMIN]),
      ),
    ),
    createWorkflow: "any member of the target organization (plan limit)",
    updateWorkflow: "org admin or a per-workflow editor grant",
    deleteWorkflow: "org admin or a per-workflow editor grant",
    publishEvent: "member of the event's organization",
  },
};

describe("GraphQL schema surface", () => {
  test("matches the reviewed policy", () => {
    assertSchemaSurface(schema, POLICY);
  });

  test("every table read outside the catalogs is organization scoped", () => {
    for (const field of findTableReadFields(schema)) {
      if (POLICY.Query?.[field] === CATALOG) continue;
      expect(ORG_SCOPED_QUERY_FIELDS).toContain(field);
    }
  });

  test("internal tables are not readable", () => {
    for (const type of ["WardenSyncQueue", "EmailSuppression", "Outbox"]) {
      expect(schema.getType(type)).toBeUndefined();
    }
  });

  test("catalog and user rows do not reach other organizations' rows", () => {
    const fieldsOf = (type: string) =>
      Object.keys(
        (
          schema.getType(type) as { getFields?: () => object } | undefined
        )?.getFields?.() ?? {},
      );

    // A plugin's author or a workflow's creator must not list that user's
    // rows in other organizations; a shared integration definition must not
    // list every organization's integrations (and their OAuth tokens)
    for (const field of [
      "authoredPlugins",
      "userOrganizations",
      "workflowsByCreatedBy",
      "workflowVersionsByCreatedBy",
    ]) {
      expect(fieldsOf("User")).not.toContain(field);
    }
    expect(fieldsOf("IntegrationDefinition")).not.toContain(
      "integrationsByDefinitionId",
    );
    expect(fieldsOf("UserFilter")).not.toContain("workflowsByCreatedBy");
    expect(fieldsOf("IntegrationDefinitionFilter")).not.toContain(
      "integrationsByDefinitionId",
    );
  });
});
