import { PgAggregatesPreset } from "@graphile/pg-aggregates";
import { PgSimplifyInflectionPreset } from "@graphile/simplify-inflection";
import { makePgService } from "postgraphile/adaptors/pg";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { PostGraphileConnectionFilterPreset } from "postgraphile-plugin-connection-filter";

import {
  IntegrationPlugin,
  InvitationPlugin,
  PluginPlugin,
  UserPlugin,
  WorkflowPlugin,
  WorkspacePlugin,
  WorkspaceUserPlugin,
} from "lib/graphql/plugins/authorization";
import { DATABASE_URL, isDevEnv, isProdEnv } from "./env.config";

/** Authorization plugins that can be exported */
const authorizationPlugins = [
  IntegrationPlugin,
  InvitationPlugin,
  PluginPlugin,
  UserPlugin,
  WorkflowPlugin,
  WorkspacePlugin,
  WorkspaceUserPlugin,
];

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
  plugins: authorizationPlugins,
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
