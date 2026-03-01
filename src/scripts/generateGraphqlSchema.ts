import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { EXPORTABLE, exportSchema } from "graphile-export";
import { printSchema } from "graphql";
import { makeSchema } from "postgraphile";
import { context, lambda, sideEffect } from "postgraphile/grafast";
import { replaceInFile } from "replace-in-file";
import { match } from "ts-pattern";

import { graphileBasePreset } from "lib/config/graphile.config";
import { dbPool } from "lib/db/db";
import {
  deadLetterEventTable,
  eventRoutingRuleTable,
  workflowRunTable,
  workflowTable,
} from "lib/db/schema";
import { assertUnderLimit, getPlanLimit } from "lib/entitlements/enforce";
import { FEATURE_KEYS } from "lib/aether/client";
import {
  executePublishEvent,
  hatchetClient,
  matchGlobPattern,
} from "lib/graphql/plugins/publishEvent.plugin";
import logger from "lib/logger";
import { workflowVersionTable } from "lib/db/schema/workflowVersion.table";

const CACHE_DIR = `${__dirname}/../../.cache`;
const HASH_FILE = `${CACHE_DIR}/schema-hash`;
const SCHEMA_DIR = `${__dirname}/../lib/db/schema`;

/**
 * Compute hash of all schema files.
 */
const computeSchemaHash = (): string => {
  const hash = createHash("sha256");

  const files = readdirSync(SCHEMA_DIR, { recursive: true })
    .filter((f): f is string => typeof f === "string" && f.endsWith(".ts"))
    .sort();

  for (const file of files) {
    const content = readFileSync(join(SCHEMA_DIR, file));
    hash.update(file);
    hash.update(content);
  }

  return hash.digest("hex");
};

/**
 * Check if schema has changed since last generation.
 */
const hasSchemaChanged = (): boolean => {
  if (!existsSync(HASH_FILE)) return true;

  const currentHash = computeSchemaHash();
  const storedHash = readFileSync(HASH_FILE, "utf-8").trim();

  return currentHash !== storedHash;
};

/**
 * Generate a GraphQL schema from a Postgres database.
 * @see https://postgraphile.org/postgraphile/next/exporting-schema
 */
const generateGraphqlSchema = async () => {
  // skip if schema unchanged
  if (!hasSchemaChanged()) {
    console.info("[graphql:generate] Schema unchanged, skipping generation");
    return;
  }

  const { schema } = await makeSchema(graphileBasePreset);

  const generatedDirectory = `${__dirname}/../generated/graphql`;
  const schemaFilePath = `${generatedDirectory}/schema.executable.ts`;

  // create artifacts directory if it doesn't exist
  if (!existsSync(generatedDirectory))
    mkdirSync(generatedDirectory, { recursive: true });

  await exportSchema(schema, schemaFilePath, {
    mode: "typeDefs",
    modules: {
      "graphile-export": { EXPORTABLE },
      "postgraphile/grafast": { context, lambda, sideEffect },
      "ts-pattern": { match },
      "drizzle-orm": { and, desc, eq },
      "node:crypto": { randomUUID },
      "lib/db/db": { dbPool },
      "lib/db/schema": {
        deadLetterEventTable,
        eventRoutingRuleTable,
        workflowRunTable,
        workflowTable,
      },
      "lib/db/schema/workflowVersion.table": { workflowVersionTable },
      "lib/logger": { default: logger },
      "lib/entitlements/enforce": { getPlanLimit, assertUnderLimit },
      "lib/aether/client": { FEATURE_KEYS },
      "lib/graphql/plugins/publishEvent.plugin": {
        executePublishEvent,
        hatchetClient,
        matchGlobPattern,
      },
    },
  });

  await replaceInFile({
    files: schemaFilePath,
    from: /\/\* eslint-disable graphile-export\/export-instances, graphile-export\/export-methods, graphile-export\/export-plans, graphile-export\/exhaustive-deps \*\//g,
    to: "// @ts-nocheck",
  });

  // emit SDL
  writeFileSync(`${generatedDirectory}/schema.graphql`, printSchema(schema));

  // save hash
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(HASH_FILE, computeSchemaHash());

  console.info("[graphql:generate] Schema generated successfully");
};

await generateGraphqlSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
