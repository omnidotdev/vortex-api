/**
 * Catalog sync logic for fetching Activepieces integration metadata from npm
 *
 * Provides a pure function to fetch and transform the catalog — no file I/O,
 * no console output. Used by both the CLI script and the internal API route.
 */

const NPM_REGISTRY = "https://registry.npmjs.org";

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

/** A single integration catalog entry */
export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  category: string;
  mcpPackage: string;
  npmUrl: string;
  version: string;
  lastUpdated: string;
};

/** Result of a catalog sync operation */
export type CatalogResult = {
  generatedAt: string;
  total: number;
  entries: CatalogEntry[];
};

/**
 * Convert package name to readable display name
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
 * Infer category from package name or keywords
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
 * Generate a stable ID from package name
 */
function toId(packageName: string): string {
  return packageName.replace("@activepieces/piece-", "");
}

/**
 * Fetch all @activepieces/piece-* packages from npm and return a structured catalog
 *
 * Performs paginated fetches against the npm registry search API. Does not
 * perform any file I/O or console output.
 * @returns Catalog result with entries sorted alphabetically by name
 */
async function fetchCatalogFromNpm(): Promise<CatalogResult> {
  const entries: CatalogEntry[] = [];
  let offset = 0;
  const limit = 250;

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

    if (offset + limit >= data.total) {
      break;
    }

    offset += limit;
  }

  // Sort alphabetically by name
  entries.sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    total: entries.length,
    entries,
  };
}

export default fetchCatalogFromNpm;
