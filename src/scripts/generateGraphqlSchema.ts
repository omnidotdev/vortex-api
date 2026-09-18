import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { printSchema } from "graphql";
import { makeSchema } from "postgraphile";

import { graphileBasePreset } from "lib/config/graphile.config";

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
 * Generate the GraphQL SDL from a Postgres database.
 *
 * Only the SDL (`schema.graphql`) is emitted; it feeds client codegen. The
 * runtime builds its executable schema at boot via `makeSchema` (see
 * `server.ts`), so there is no pre-compiled executable schema to keep in sync,
 * and no `exportSchema` step (which cannot serialize plans that close over
 * runtime singletons).
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

  // create artifacts directory if it doesn't exist
  if (!existsSync(generatedDirectory))
    mkdirSync(generatedDirectory, { recursive: true });

  // emit SDL
  writeFileSync(
    `${generatedDirectory}/schema.graphql`,
    printSchema(schema as unknown as Parameters<typeof printSchema>[0]),
  );

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
