import { EXPORTABLE } from "graphile-export";
import { sql } from "postgraphile/pg-sql2";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { wrapPlans } from "postgraphile/utils";

import type { SQL } from "postgraphile/pg-sql2";
import type { PlanWrapperFn } from "postgraphile/utils";

/**
 * Add organization scoping to a collection (connection) query.
 *
 * Injects a `WHERE organization_id = ANY(...)` condition into the
 * underlying PgSelectStep via the pgSettings session variable set
 * by the authentication plugin. This ensures users can only read
 * data belonging to their organizations.
 */
const scopeCollection = (): PlanWrapperFn =>
  EXPORTABLE(
    (sql): PlanWrapperFn =>
      (plan) => {
        const $connection = plan();

        // getSubplan() returns the PgSelectStep backing the connection
        const $select = (
          $connection as {
            getSubplan: () => { where: (spec: unknown) => void };
          }
        ).getSubplan();

        $select.where({
          type: "attribute",
          attribute: "organization_id",
          callback(expression: SQL) {
            return sql`${expression} = ANY(coalesce(current_setting('app.organization_ids', true)::text[], '{}'))`;
          },
        });

        return $connection;
      },
    [sql],
  );

/**
 * Add organization scoping to a single-item query.
 *
 * Verifies the resolved item belongs to one of the authenticated
 * user's organizations. Throws "Not found" if unauthorized, making
 * cross-org items invisible rather than returning a 403.
 */
const scopeSingleItem = (): PlanWrapperFn =>
  EXPORTABLE(
    (SafeError, context, sideEffect): PlanWrapperFn =>
      (plan) => {
        const $item = plan();
        const $observer = context().get("observer");
        const $organizationIds = context().get("organizationIds");

        sideEffect(
          [$item, $observer, $organizationIds],
          async ([item, observer, organizationIds]) => {
            if (!item || !observer) return;

            // Skip items without organizationId (shared/global data)
            if (typeof item !== "object" || !("organizationId" in item)) return;

            const itemOrgId = (item as { organizationId: string })
              .organizationId;

            if (
              !Array.isArray(organizationIds) ||
              !organizationIds.includes(itemOrgId)
            ) {
              throw new SafeError("Not found");
            }
          },
        );

        return $item;
      },
    [SafeError, context, sideEffect],
  );

/**
 * Organization scoping plugin for GraphQL queries.
 *
 * Ensures read operations on org-scoped tables return only data belonging
 * to the authenticated user's organizations:
 *
 * - **Collection queries**: filtered at the SQL level via a WHERE clause
 *   using `current_setting('app.organization_ids')` (set via pgSettings)
 * - **Single-item queries**: verified post-resolution against the user's
 *   organization membership from the Grafast context
 *
 * Tables without `organization_id` (e.g. `user`, `workflow_run`,
 * `event_schema`, `workflow_template`) are not directly scoped here.
 * Child tables like `workflow_run` are indirectly protected because
 * their parent entities are scoped and the authentication gate blocks
 * unauthenticated access.
 *
 * TODO: add scoping for child tables (workflow_run, workflow_step_log,
 * workflow_version, saga_step_log) via JOIN-based filtering
 */
const OrganizationScopePlugin = wrapPlans({
  Query: {
    // Collection queries - SQL-level WHERE organization_id filtering
    workflows: scopeCollection(),
    integrations: scopeCollection(),
    mcpServers: scopeCollection(),
    plugins: scopeCollection(),
    pluginUsages: scopeCollection(),
    deadLetterEvents: scopeCollection(),
    eventRoutingRules: scopeCollection(),
    eventLogs: scopeCollection(),
    eventSubscriptions: scopeCollection(),
    subscriptionDeliveries: scopeCollection(),
    sagaRuns: scopeCollection(),
    workflowExecutorConfigs: scopeCollection(),
    fns: scopeCollection(),
    rivetGraphs: scopeCollection(),
    approvalRequests: scopeCollection(),
    oauthTokens: scopeCollection(),
    oauthStates: scopeCollection(),

    // Single-item queries (by rowId) - post-resolution org membership check
    workflow: scopeSingleItem(),
    integration: scopeSingleItem(),
    mcpServer: scopeSingleItem(),
    plugin: scopeSingleItem(),
    pluginUsage: scopeSingleItem(),
    deadLetterEvent: scopeSingleItem(),
    eventRoutingRule: scopeSingleItem(),
    eventLog: scopeSingleItem(),
    eventSubscription: scopeSingleItem(),
    subscriptionDelivery: scopeSingleItem(),
    sagaRun: scopeSingleItem(),
    workflowExecutorConfig: scopeSingleItem(),
    fn: scopeSingleItem(),
    rivetGraph: scopeSingleItem(),
    approvalRequest: scopeSingleItem(),
    oauthToken: scopeSingleItem(),
    oauthState: scopeSingleItem(),

    // Single-item queries (by Relay global ID)
    workflowById: scopeSingleItem(),
    integrationById: scopeSingleItem(),
    mcpServerById: scopeSingleItem(),
    pluginById: scopeSingleItem(),
    pluginUsageById: scopeSingleItem(),
    deadLetterEventById: scopeSingleItem(),
    eventRoutingRuleById: scopeSingleItem(),
    eventLogById: scopeSingleItem(),
    eventSubscriptionById: scopeSingleItem(),
    subscriptionDeliveryById: scopeSingleItem(),
    sagaRunById: scopeSingleItem(),
    workflowExecutorConfigById: scopeSingleItem(),
    fnById: scopeSingleItem(),
    rivetGraphById: scopeSingleItem(),
    approvalRequestById: scopeSingleItem(),
    oauthTokenById: scopeSingleItem(),
    oauthStateById: scopeSingleItem(),
  },
});

export default OrganizationScopePlugin;
