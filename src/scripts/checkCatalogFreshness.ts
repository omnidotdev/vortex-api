#!/usr/bin/env bun
/**
 * Check Catalog Freshness
 *
 * Verifies the integration catalog is up-to-date with vortex-worker's installed pieces.
 * Exits with code 1 if stale, 0 if fresh.
 *
 * Usage:
 *   bun run catalog:check
 *
 * This can be run in CI or as a pre-commit/pre-seed hook to catch drift.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

const CATALOG_PATH = join(import.meta.dir, "../data/integrations/catalog.json");
const WORKER_PIECES_PATH = join(
  import.meta.dir,
  "../../../vortex-worker/node_modules/@activepieces",
);

// Max age before considered stale (7 days)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Catalog {
  generatedAt: string;
  total: number;
}

async function countInstalledPieces(): Promise<number> {
  try {
    const entries = await readdir(WORKER_PIECES_PATH, { withFileTypes: true });
    return entries.filter(
      (e) =>
        e.isDirectory() &&
        e.name.startsWith("piece-") &&
        !["pieces-framework", "pieces-common"].includes(e.name),
    ).length;
  } catch {
    return -1;
  }
}

async function main() {
  // Check if catalog exists
  const catalogFile = Bun.file(CATALOG_PATH);
  if (!(await catalogFile.exists())) {
    console.error("Catalog not found at:", CATALOG_PATH);
    console.error("\nRun: cd ../vortex-worker && bun catalog:generate");
    process.exit(1);
  }

  // Load catalog
  const catalog = (await catalogFile.json()) as Catalog;
  const generatedAt = new Date(catalog.generatedAt);
  const ageMs = Date.now() - generatedAt.getTime();
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

  console.log(`Catalog generated: ${generatedAt.toISOString()}`);
  console.log(`Catalog age: ${ageDays} days`);
  console.log(`Catalog entries: ${catalog.total}`);

  // Count installed pieces (skip if vortex-worker is not available, e.g. in CI)
  const installedCount = await countInstalledPieces();
  if (installedCount === -1) {
    console.log("Skipping piece count check (vortex-worker not available)");
  } else {
    console.log(`Installed pieces: ${installedCount}`);
  }

  // Check for issues
  const issues: string[] = [];

  // Check age
  if (ageMs > MAX_AGE_MS) {
    issues.push(`Catalog is ${ageDays} days old (max: 7 days)`);
  }

  // Check count mismatch (allow some tolerance for loading failures)
  if (installedCount !== -1) {
    const countDiff = Math.abs(catalog.total - installedCount);
    if (countDiff > 10) {
      issues.push(
        `Catalog has ${catalog.total} entries but ${installedCount} pieces installed (diff: ${countDiff})`,
      );
    }
  }

  if (issues.length > 0) {
    console.error("\nCatalog is STALE:");
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    console.error("\nTo regenerate:");
    console.error("  cd ../vortex-worker && bun catalog:generate");
    process.exit(1);
  }

  console.log("\nCatalog is fresh.");
}

main().catch((error) => {
  console.error("Error checking catalog:", error);
  process.exit(1);
});
