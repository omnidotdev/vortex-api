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
  IntegrationPlugin,
  McpServerPlugin,
  OrganizationScopePlugin,
  PluginPlugin,
  UserPlugin,
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
  IntegrationPlugin,
  McpServerPlugin,
  OrganizationScopePlugin,
  PluginPlugin,
  UserPlugin,
  WorkflowPlugin,
];

/** Encryption plugins for sensitive data */
const encryptionPlugins = [IntegrationEncryptionPlugin];

/** Custom mutation plugins */
const mutationPlugins = [PublishEventPlugin];

/**
 * Omit REST-only tables from the GraphQL schema.
 * `workflow_permission` has dual FKs to `user` that cause naming conflicts,
 * and is managed exclusively via REST endpoints.
 */
const SmartTagsPlugin = makePgSmartTagsPlugin([
  {
    kind: "class",
    match: "public.workflow_permission",
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
