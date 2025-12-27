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

const NPM_REGISTRY = "https://registry.npmjs.org";
const OUTPUT_PATH = join(
  import.meta.dir,
  "../src/data/integrations/catalog.json",
);

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      date: string;
      links: {
        npm?: string;
        homepage?: string;
        repository?: string;
      };
    };
  }>;
  total: number;
}

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  mcpPackage: string;
  npmUrl: string;
  version: string;
  lastUpdated: string;
}

/**
 * Convert package name to readable display name.
 * @example "@activepieces/piece-github" -> "GitHub"
 */
function toDisplayName(packageName: string): string {
  const piece = packageName.replace("@activepieces/piece-", "");
  return piece
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Infer category from package name or keywords.
 */
function inferCategory(packageName: string, keywords: string[] = []): string {
  const name = packageName.toLowerCase();
  const keywordStr = keywords.join(" ").toLowerCase();

  if (
    name.includes("slack") ||
    name.includes("discord") ||
    name.includes("telegram") ||
    name.includes("teams") ||
    keywordStr.includes("chat") ||
    keywordStr.includes("messaging")
  ) {
    return "communication";
  }

  if (
    name.includes("github") ||
    name.includes("gitlab") ||
    name.includes("bitbucket") ||
    name.includes("jira") ||
    name.includes("linear") ||
    keywordStr.includes("developer") ||
    keywordStr.includes("code")
  ) {
    return "developer";
  }

  if (
    name.includes("openai") ||
    name.includes("anthropic") ||
    name.includes("claude") ||
    name.includes("gpt") ||
    name.includes("llm") ||
    keywordStr.includes("ai") ||
    keywordStr.includes("machine learning")
  ) {
    return "ai";
  }

  if (
    name.includes("stripe") ||
    name.includes("paypal") ||
    name.includes("square") ||
    keywordStr.includes("payment") ||
    keywordStr.includes("billing")
  ) {
    return "payments";
  }

  if (
    name.includes("sendgrid") ||
    name.includes("resend") ||
    name.includes("mailchimp") ||
    name.includes("mailgun") ||
    keywordStr.includes("email")
  ) {
    return "email";
  }

  if (
    name.includes("twilio") ||
    name.includes("sms") ||
    keywordStr.includes("sms") ||
    keywordStr.includes("phone")
  ) {
    return "sms";
  }

  if (
    name.includes("sheets") ||
    name.includes("notion") ||
    name.includes("airtable") ||
    name.includes("asana") ||
    name.includes("trello") ||
    keywordStr.includes("productivity")
  ) {
    return "productivity";
  }

  if (
    name.includes("postgres") ||
    name.includes("mysql") ||
    name.includes("mongodb") ||
    name.includes("redis") ||
    keywordStr.includes("database")
  ) {
    return "database";
  }

  if (
    name.includes("s3") ||
    name.includes("dropbox") ||
    name.includes("drive") ||
    keywordStr.includes("storage") ||
    keywordStr.includes("file")
  ) {
    return "storage";
  }

  return "other";
}

/**
 * Generate a stable ID from package name.
 */
function toId(packageName: string): string {
  return packageName.replace("@activepieces/piece-", "");
}

/**
 * Fetch all @activepieces/piece-* packages from npm.
 */
async function fetchActivepiecesPieces(): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = [];
  let offset = 0;
  const limit = 250; // npm search limit

  // biome-ignore lint/suspicious/noConsole: CLI script logging
  console.log("Fetching @activepieces/piece-* packages from npm...");

  while (true) {
    const url = `${NPM_REGISTRY}/-/v1/search?text=@activepieces/piece-&size=${limit}&from=${offset}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`npm registry error: ${response.status}`);
    }

    const data = (await response.json()) as NpmSearchResult;

    for (const { package: pkg } of data.objects) {
      // Only include actual piece packages
      if (!pkg.name.startsWith("@activepieces/piece-")) {
        continue;
      }

      // Skip internal/utility packages
      if (
        pkg.name.includes("-common") ||
        pkg.name.includes("-framework") ||
        pkg.name.includes("-cli")
      ) {
        continue;
      }

      entries.push({
        id: toId(pkg.name),
        name: toDisplayName(pkg.name),
        description: pkg.description || "",
        category: inferCategory(pkg.name, pkg.keywords),
        mcpPackage: pkg.name,
        npmUrl: pkg.links.npm || `https://www.npmjs.com/package/${pkg.name}`,
        version: pkg.version,
        lastUpdated: pkg.date,
      });
    }

    // biome-ignore lint/suspicious/noConsole: CLI script logging
    console.log(`  Fetched ${entries.length} / ${data.total} packages...`);

    if (offset + limit >= data.total) {
      break;
    }

    offset += limit;
  }

  // Sort alphabetically by name
  entries.sort((a, b) => a.name.localeCompare(b.name));

  return entries;
}

/**
 * Main function.
 */
async function main() {
  try {
    const entries = await fetchActivepiecesPieces();

    // biome-ignore lint/suspicious/noConsole: CLI script logging
    console.log(`\nFound ${entries.length} Activepieces pieces.`);

    // Group by category for summary
    const byCategory = entries.reduce(
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
      generatedAt: new Date().toISOString(),
      total: entries.length,
      entries,
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
