#!/usr/bin/env bun
/**
 * Sync Integration Catalog from npm registry
 *
 * Fetches all @activepieces/piece-* packages from npm and generates
 * a catalog.json file for the "All Integrations" section.
 *
 * Usage:
 *   bun run scripts/syncIntegrationCatalog.ts
 *
 * Output:
 *   src/data/integrations/catalog.json
 *
 * This script is designed to run nightly via CI and open a PR for review.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import fetchCatalogFromNpm from "@/lib/integrations/catalogSync";

const OUTPUT_PATH = join(
  import.meta.dir,
  "../src/data/integrations/catalog.json",
);

async function main() {
  try {
    // biome-ignore lint/suspicious/noConsole: CLI script logging
    console.log("Fetching @activepieces/piece-* packages from npm...");

    const catalog = await fetchCatalogFromNpm();

    // biome-ignore lint/suspicious/noConsole: CLI script logging
    console.log(`\nFound ${catalog.total} Activepieces pieces.`);

    // Group by category for summary
    const byCategory = catalog.entries.reduce(
      (acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // biome-ignore lint/suspicious/noConsole: CLI script logging
    console.log("\nBy category:");
    for (const [cat, count] of Object.entries(byCategory).sort()) {
      // biome-ignore lint/suspicious/noConsole: CLI script logging
      console.log(`  ${cat}: ${count}`);
    }

    // Write output
    const output = {
      $schema: "./catalog.schema.json",
      ...catalog,
    };

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

    // biome-ignore lint/suspicious/noConsole: CLI script logging
    console.log(`\nWrote catalog to: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("Error syncing catalog:", error);
    process.exit(1);
  }
}

main();
