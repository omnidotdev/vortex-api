import { EXPORTABLE } from "graphile-export";
import { SafeError, context, sideEffect } from "postgraphile/grafast";
import { sql } from "postgraphile/pg-sql2";
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
            return sql`${expression} = ANY(coalesce(nullif(current_setting('app.organization_ids', true), ''), '{}')::text[])`;
          },
        });

        return $connection;
      },
    [sql],
  );

/**
 * Add visibility-aware scoping to a collection query.
 *
 * Return rows where visibility is 'public' OR the row belongs to
 * one of the user's organizations. Used for shared catalogs like
 * event schemas where some entries are globally visible
 */
const scopeVisibleCollection = (): PlanWrapperFn =>
  EXPORTABLE(
    (sql): PlanWrapperFn =>
      (plan) => {
        const $connection = plan();

        const $select = (
          $connection as {
            getSubplan: () => { where: (spec: unknown) => void };
          }
        ).getSubplan();

        $select.where({
          type: "attribute",
          attribute: "visibility",
          callback(expression: SQL) {
            return sql`(${expression} = 'public' OR organization_id = ANY(coalesce(nullif(current_setting('app.organization_ids', true), ''), '{}')::text[]))`;
          },
        });

        return $connection;
      },
    [sql],
  );

/**
 * Scope a child collection via EXISTS subquery on a parent table.
 *
 * Used for tables without their own `organization_id` that reference
 * an org-scoped parent (e.g. workflow_run → workflow).
 */
const scopeChildCollection = (
  parentTable: string,
  fkColumn: string,
  parentPk: string = "id",
): PlanWrapperFn =>
  EXPORTABLE(
    (sql, parentTable, fkColumn, parentPk): PlanWrapperFn =>
      (plan) => {
        const $connection = plan();

        const $select = (
          $connection as {
            getSubplan: () => { where: (spec: unknown) => void };
          }
        ).getSubplan();

        $select.where({
          type: "attribute",
          attribute: fkColumn,
          callback(expression: SQL) {
            return sql`${expression} IN (SELECT ${sql.identifier(parentPk)} FROM ${sql.identifier(parentTable)} WHERE organization_id = ANY(coalesce(nullif(current_setting('app.organization_ids', true), ''), '{}')::text[]))`;
          },
        });

        return $connection;
      },
    [sql, parentTable, fkColumn, parentPk],
  );

/**
 * Scope a grandchild collection via nested EXISTS subquery.
 *
 * Used for tables two levels removed from the org-scoped parent
 * (e.g. workflow_step_log → workflow_run → workflow).
 */
const scopeGrandchildCollection = (
  parentTable: string,
  fkColumn: string,
  grandparentTable: string,
  parentFkColumn: string,
  parentPk: string = "id",
  grandparentPk: string = "id",
): PlanWrapperFn =>
  EXPORTABLE(
    (
      sql,
      parentTable,
      fkColumn,
      grandparentTable,
      parentFkColumn,
      parentPk,
      grandparentPk,
    ): PlanWrapperFn =>
      (plan) => {
        const $connection = plan();

        const $select = (
          $connection as {
            getSubplan: () => { where: (spec: unknown) => void };
          }
        ).getSubplan();

        $select.where({
          type: "attribute",
          attribute: fkColumn,
          callback(expression: SQL) {
            return sql`${expression} IN (SELECT ${sql.identifier(parentPk)} FROM ${sql.identifier(parentTable)} WHERE ${sql.identifier(parentFkColumn)} IN (SELECT ${sql.identifier(grandparentPk)} FROM ${sql.identifier(grandparentTable)} WHERE organization_id = ANY(coalesce(nullif(current_setting('app.organization_ids', true), ''), '{}')::text[])))`;
          },
        });

        return $connection;
      },
    [
      sql,
      parentTable,
      fkColumn,
      grandparentTable,
      parentFkColumn,
      parentPk,
      grandparentPk,
    ],
  );

/**
 * Scope a single child item by resolving its parent's org ownership.
 *
 * Fetches the parent row via the FK, then checks the parent's
 * organizationId against the user's org membership.
 */
const scopeChildSingleItem = (
  parentTable: string,
  fkField: string,
): PlanWrapperFn =>
  EXPORTABLE(
    (SafeError, context, sideEffect, parentTable, fkField): PlanWrapperFn =>
      (plan) => {
        const $item = plan();
        const $observer = context().get("observer");
        const $db = context().get("db");
        const $organizationIds = context().get("organizationIds");

        sideEffect(
          [$item, $observer, $db, $organizationIds],
          async ([item, observer, db, organizationIds]) => {
            if (!item || !observer) return;
            if (typeof item !== "object" || !(fkField in item)) return;

            const fkValue = (item as Record<string, string>)[fkField];
            if (!fkValue) return;

            // Look up the parent to get its organizationId
            const parentTableRef =
              db.query[`${parentTable}Table` as keyof typeof db.query];
            if (!parentTableRef) return;

            const parent =
              await // biome-ignore lint/complexity/noBannedTypes: dynamic Drizzle query interface
              (parentTableRef as { findFirst: Function }).findFirst({
                where: (
                  table: Record<string, unknown>,
                  // biome-ignore lint/complexity/noBannedTypes: dynamic Drizzle query interface
                  { eq }: { eq: Function },
                ) => eq(table.id, fkValue),
              });

            if (!parent?.organizationId) {
              throw new SafeError("Not found");
            }

            if (
              !Array.isArray(organizationIds) ||
              !organizationIds.includes(parent.organizationId)
            ) {
              throw new SafeError("Not found");
            }
          },
        );

        return $item;
      },
    [SafeError, context, sideEffect, parentTable, fkField],
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

            // Allow public items through regardless of org membership
            if (
              "visibility" in item &&
              (item as { visibility: string }).visibility === "public"
            )
              return;

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
 * Tables without `organization_id` (e.g. `user`, `workflow_template`)
 * are not directly scoped here.
 *
 * Child tables without their own `organization_id` are scoped via
 * EXISTS subqueries against their org-scoped parent tables
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
    eventSchemata: scopeVisibleCollection(),
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

    // Child table collections - scoped via parent FK joins
    workflowRuns: scopeChildCollection("workflow", "workflow_id"),
    workflowVersions: scopeChildCollection("workflow", "workflow_id"),
    workflowStepLogs: scopeGrandchildCollection(
      "workflow_run",
      "workflow_run_id",
      "workflow",
      "workflow_id",
    ),
    sagaStepLogs: scopeChildCollection("saga_run", "saga_run_id"),

    // Single-item queries (by rowId) - post-resolution org membership check
    workflow: scopeSingleItem(),
    integration: scopeSingleItem(),
    mcpServer: scopeSingleItem(),
    plugin: scopeSingleItem(),
    pluginUsage: scopeSingleItem(),
    deadLetterEvent: scopeSingleItem(),
    eventRoutingRule: scopeSingleItem(),
    eventSchema: scopeSingleItem(),
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

    // Child table single-item queries - scoped via parent FK lookup
    workflowRun: scopeChildSingleItem("workflow", "workflowId"),
    workflowVersion: scopeChildSingleItem("workflow", "workflowId"),
    workflowStepLog: scopeChildSingleItem("workflowRun", "workflowRunId"),
    sagaStepLog: scopeChildSingleItem("sagaRun", "sagaRunId"),

    // Single-item queries (by Relay global ID)
    workflowById: scopeSingleItem(),
    integrationById: scopeSingleItem(),
    mcpServerById: scopeSingleItem(),
    pluginById: scopeSingleItem(),
    pluginUsageById: scopeSingleItem(),
    deadLetterEventById: scopeSingleItem(),
    eventRoutingRuleById: scopeSingleItem(),
    eventSchemaById: scopeSingleItem(),
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

    // Child table by Relay global ID
    workflowRunById: scopeChildSingleItem("workflow", "workflowId"),
    workflowVersionById: scopeChildSingleItem("workflow", "workflowId"),
    workflowStepLogById: scopeChildSingleItem("workflowRun", "workflowRunId"),
    sagaStepLogById: scopeChildSingleItem("sagaRun", "sagaRunId"),
  },
});

export default OrganizationScopePlugin;
