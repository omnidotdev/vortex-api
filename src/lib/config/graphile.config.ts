import { PgAggregatesPreset } from "@graphile/pg-aggregates";
import { PgSimplifyInflectionPreset } from "@graphile/simplify-inflection";
import { makePgSmartTagsPlugin } from "graphile-utils";
import { makePgService } from "postgraphile/adaptors/pg";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { PostGraphileConnectionFilterPreset } from "postgraphile-plugin-connection-filter";

import {
  DeadLetterEventPlugin,
  EventLogPlugin,
  EventRoutingRulePlugin,
  EventSchemaPlugin,
  EventSubscriptionPlugin,
  IntegrationPlugin,
  McpServerPlugin,
  OrganizationScopePlugin,
  PluginPlugin,
  WorkflowPlugin,
} from "lib/graphql/plugins/authorization";
import IntegrationEncryptionPlugin from "lib/graphql/plugins/encryption/IntegrationEncryption.plugin";
import PublishEventPlugin from "lib/graphql/plugins/publishEvent.plugin";
import { DATABASE_URL, isDevEnv, isProdEnv } from "./env.config";

/** Authorization plugins that can be exported */
const authorizationPlugins = [
  DeadLetterEventPlugin,
  EventLogPlugin,
  EventRoutingRulePlugin,
  EventSchemaPlugin,
  EventSubscriptionPlugin,
  IntegrationPlugin,
  McpServerPlugin,
  OrganizationScopePlugin,
  PluginPlugin,
  WorkflowPlugin,
];

/** Encryption plugins for sensitive data */
const encryptionPlugins = [IntegrationEncryptionPlugin];

/** Custom mutation plugins */
const mutationPlugins = [PublishEventPlugin];

/**
 * Tables whose auto-generated create/update/delete mutations are removed from
 * the GraphQL schema entirely. These are written only by the system (webhooks,
 * dispatch, reconcilers, OAuth flows, IDP sync) through the direct DB pool, and
 * were never meant to be mutable by an authenticated GraphQL caller. Leaving
 * them exposed let any signed-in user create/patch/delete internal plumbing
 * (event logs, saga/workflow runs, outbox, warden sync queue, OAuth tokens) and,
 * most dangerously, self-provision or escalate organization membership via
 * `user_organization`. Reads that should stay available (catalogs, run history)
 * are unaffected and remain organization-scoped by OrganizationScopePlugin.
 */
const MUTATION_LOCKED_TABLES = [
  "approval_request",
  "dead_letter_event",
  "email_suppression",
  "event_log",
  "fn",
  "integration_definition",
  "oauth_state",
  "oauth_token",
  "plugin_marketplace",
  "plugin_usage",
  "rivet_graph",
  "saga_run",
  "saga_step_log",
  "subscription_delivery",
  // Organization membership is synced from the IDP only; a user must never be
  // able to insert/patch/delete their own membership or role (owner escalation)
  "user_organization",
  "warden_sync_queue",
  "workflow_executor_config",
  "workflow_run",
  "workflow_step_log",
  "workflow_template",
  "workflow_version",
];

/**
 * Tables removed from the top-level Query surface as well as the mutation
 * surface. `user` carries PII and its lookups (`user`, `users`, `userByEmail`,
 * `userByIdentityProviderId`) are an account-enumeration vector; the User type
 * itself is retained so org-scoped relations (e.g. a workflow version's author)
 * still resolve. `outbox` and `warden_sync_queue` are internal plumbing whose
 * rows carry cross-tenant payloads and have no organization scoping, so they
 * must not be readable by ordinary callers.
 */
const READ_AND_MUTATION_LOCKED_TABLES = ["user", "outbox"];

/** Behavior string that removes insert/update/delete mutations for a resource. */
const NO_MUTATIONS = ["-insert", "-update", "-delete"];

/**
 * Behavior string that additionally removes every root Query entry point,
 * including the Relay `<type>ById` node accessor (`-node` drops the type from
 * the Node interface, which is what generates that global-id lookup).
 */
const NO_MUTATIONS_NO_ROOT_QUERY = [
  ...NO_MUTATIONS,
  "-query:resource:single",
  "-query:resource:connection",
  "-query:resource:list",
  "-node",
];

/**
 * Smart tags that lock down the auto-generated schema surface.
 *
 * - `workflow_permission` is removed entirely (dual FKs to `user` cause naming
 *   conflicts; managed exclusively via REST)
 * - internal/system tables lose their mutation surface (and, for a few, their
 *   root-query surface)
 * - the encrypted OAuth token secrets are never selectable or filterable
 */
const SmartTagsPlugin = makePgSmartTagsPlugin([
  {
    kind: "class",
    match: "public.workflow_permission",
    tags: { behavior: ["-*"] },
  },
  ...MUTATION_LOCKED_TABLES.map((table) => ({
    kind: "class" as const,
    match: `public.${table}`,
    tags: { behavior: NO_MUTATIONS },
  })),
  ...READ_AND_MUTATION_LOCKED_TABLES.map((table) => ({
    kind: "class" as const,
    match: `public.${table}`,
    tags: { behavior: NO_MUTATIONS_NO_ROOT_QUERY },
  })),
  // Never expose the encrypted OAuth access/refresh tokens through GraphQL,
  // in output or in connection filters
  {
    kind: "attribute" as const,
    match: "public.oauth_token.access_token",
    tags: { behavior: ["-*"] },
  },
  {
    kind: "attribute" as const,
    match: "public.oauth_token.refresh_token",
    tags: { behavior: ["-*"] },
  },
]);

/**
 * Base graphile preset (used for schema generation).
 * Does not include runtime-only plugins that have external dependencies.
 */
export const graphileBasePreset: GraphileConfig.Preset = {
  extends: [
    PostGraphileAmberPreset,
    PgSimplifyInflectionPreset,
    PostGraphileConnectionFilterPreset,
    PgAggregatesPreset,
  ],
  plugins: [
    SmartTagsPlugin,
    ...authorizationPlugins,
    ...encryptionPlugins,
    ...mutationPlugins,
  ],
  disablePlugins: ["PgIndexBehaviorsPlugin"],
  schema: {
    // Remove the Relay nodeId-based update/delete mutations globally
    // (`update<Type>ById` / `delete<Type>ById`). Only the primary-key variants
    // (`update<Type>` / `delete<Type>`) remain, and those are the ones the
    // per-entity authorization plugins wrap; the nodeId variants were an
    // unguarded parallel path into the same rows.
    defaultBehavior: "-nodeId:resource:update -nodeId:resource:delete",
    retryOnInitFail: isProdEnv,
    sortExport: true,
    pgForbidSetofFunctionsToReturnNull: true,
    jsonScalarAsString: false,
    connectionFilterAllowNullInput: true,
    connectionFilterAllowEmptyObjectInput: true,
  },
  pgServices: [makePgService({ connectionString: DATABASE_URL })],
  grafast: { explain: isDevEnv },
};
