/**
 * Connector Registry for vortex-api
 *
 * Provides metadata about available Activepieces connectors.
 * Auto-discovers installed pieces from node_modules.
 * This is a read-only registry - execution happens in vortex-worker.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { Piece } from "@activepieces/pieces-framework";

/**
 * Connector metadata returned to the frontend.
 * @knipignore - Used by getAvailableConnectors return type
 */
export interface ConnectorMetadata {
  /** Package ID (e.g., "@activepieces/piece-discord") */
  id: string;
  /** Display name */
  displayName: string;
  /** Description */
  description: string;
  /** Logo URL */
  logoUrl: string;
  /** Authors */
  authors: string[];
  /** Categories */
  categories: string[];
  /** Auth type */
  authType: "secret_text" | "oauth2" | "basic_auth" | "custom_auth" | "none";
  /** Auth display name */
  authDisplayName?: string;
  /** Auth description */
  authDescription?: string;
  /** Available actions */
  actions: ConnectorActionMeta[];
  /** Available triggers */
  triggers: ConnectorTriggerMeta[];
}

/** @knipignore - Used by ConnectorMetadata */
export interface ConnectorActionMeta {
  name: string;
  displayName: string;
  description: string;
  requireAuth: boolean;
}

/** @knipignore - Used by ConnectorMetadata */
export interface ConnectorTriggerMeta {
  name: string;
  displayName: string;
  description: string;
  type: "polling" | "webhook" | "app_webhook";
}

/**
 * Packages to exclude from auto-discovery (not actual pieces).
 */
const EXCLUDED_PACKAGES = new Set([
  "@activepieces/pieces-framework",
  "@activepieces/pieces-common",
  "@activepieces/pieces-apps",
]);

/**
 * Cache of discovered piece package names.
 */
let discoveredPieces: string[] | null = null;

/**
 * Cache of loaded connector metadata.
 */
const metadataCache = new Map<string, ConnectorMetadata>();

/**
 * Extract auth type from Activepieces piece.
 */
function extractAuthType(piece: Piece): ConnectorMetadata["authType"] {
  const auth = piece.auth;
  if (!auth) return "none";

  const authDef = Array.isArray(auth) ? auth[0] : auth;
  if (!authDef) return "none";

  const propType = (authDef as { type?: string }).type;

  switch (propType) {
    case "SECRET_TEXT":
      return "secret_text";
    case "BASIC_AUTH":
      return "basic_auth";
    case "OAUTH2":
      return "oauth2";
    case "CUSTOM_AUTH":
      return "custom_auth";
    default:
      return "none";
  }
}

/**
 * Extract auth display info from Activepieces piece.
 */
function extractAuthInfo(piece: Piece): {
  displayName?: string;
  description?: string;
} {
  const auth = piece.auth;
  if (!auth) return {};

  const authDef = Array.isArray(auth) ? auth[0] : auth;
  if (!authDef) return {};

  return {
    displayName: (authDef as { displayName?: string }).displayName,
    description: (authDef as { description?: string }).description,
  };
}

/**
 * Extract metadata from an Activepieces piece.
 */
function extractMetadata(packageId: string, piece: Piece): ConnectorMetadata {
  const meta = piece.metadata();
  const authInfo = extractAuthInfo(piece);

  const actions = Object.entries(piece.actions()).map(([name, action]) => ({
    name,
    displayName: action.displayName,
    description: action.description,
    requireAuth: action.requireAuth ?? true,
  }));

  const triggers = Object.entries(piece.triggers()).map(([name, trigger]) => ({
    name,
    displayName: trigger.displayName,
    description: trigger.description,
    type: (trigger.type === "WEBHOOK"
      ? "webhook"
      : trigger.type === "APP_WEBHOOK"
        ? "app_webhook"
        : "polling") as "polling" | "webhook" | "app_webhook",
  }));

  return {
    id: packageId,
    displayName: meta.displayName,
    description: meta.description ?? "",
    logoUrl: meta.logoUrl,
    authors: meta.authors ?? [],
    categories: (meta.categories ?? []) as string[],
    authType: extractAuthType(piece),
    authDisplayName: authInfo.displayName,
    authDescription: authInfo.description,
    actions,
    triggers,
  };
}

/**
 * Load metadata for a single connector.
 */
async function loadConnectorMetadata(
  packageId: string,
): Promise<ConnectorMetadata | null> {
  // Check cache
  const cached = metadataCache.get(packageId);
  if (cached) return cached;

  try {
    // Dynamic import of the Activepieces piece
    const module = await import(packageId);

    // Activepieces pieces export a default piece instance
    const piece: Piece = module.default ?? module[Object.keys(module)[0]];
    if (!piece) {
      return null;
    }

    const metadata = extractMetadata(packageId, piece);
    metadataCache.set(packageId, metadata);

    return metadata;
  } catch {
    // Package not installed or failed to load
    return null;
  }
}

/**
 * Auto-discover installed Activepieces piece packages from node_modules.
 * Scans @activepieces scope for piece-* packages.
 * @knipignore - Public API for connector discovery
 */
export async function discoverPieces(): Promise<string[]> {
  if (discoveredPieces) return discoveredPieces;

  const pieces: string[] = [];

  try {
    // Find the node_modules directory (works with bun workspaces)
    const nodeModulesPath = join(
      import.meta.dirname ?? process.cwd(),
      "..",
      "..",
      "..",
      "node_modules",
      "@activepieces",
    );

    const entries = await readdir(nodeModulesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const packageId = `@activepieces/${entry.name}`;

      // Only include piece-* packages, exclude framework/common packages
      if (
        entry.name.startsWith("piece-") &&
        !EXCLUDED_PACKAGES.has(packageId)
      ) {
        pieces.push(packageId);
      }
    }
  } catch {
    // Auto-discovery failed, return empty list (pieces not installed)
  }

  discoveredPieces = pieces;
  return pieces;
}

/**
 * Get metadata for all available connectors.
 * Uses auto-discovery to find all installed Activepieces pieces.
 */
export async function getAvailableConnectors(): Promise<ConnectorMetadata[]> {
  const pieces = await discoverPieces();
  const results = await Promise.all(pieces.map(loadConnectorMetadata));
  return results.filter((c): c is ConnectorMetadata => c !== null);
}

/**
 * Get metadata for a specific connector.
 * @knipignore - Public API for getting connector details
 */
export async function getConnectorMetadata(
  packageId: string,
): Promise<ConnectorMetadata | null> {
  return loadConnectorMetadata(packageId);
}

/**
 * List discovered connector IDs (triggers discovery if needed).
 * @knipignore - Public API for listing connectors
 */
export async function listConnectorIds(): Promise<string[]> {
  return discoverPieces();
}

/**
 * Check if a connector ID is valid (follows Activepieces naming convention).
 * @knipignore - Public API for validation
 */
export function isValidConnectorId(id: string): boolean {
  return id.startsWith("@activepieces/piece-");
}
