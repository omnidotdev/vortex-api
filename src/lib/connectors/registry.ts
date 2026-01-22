/**
 * Connector Registry for vortex-api
 *
 * Provides metadata about available Activepieces connectors.
 * This is a read-only registry - execution happens in vortex-worker.
 */

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
 * Available connector packages.
 * These must be installed as dependencies in vortex-api.
 */
const AVAILABLE_CONNECTORS = [
  "@activepieces/piece-discord",
  "@activepieces/piece-slack",
  "@activepieces/piece-github",
  "@activepieces/piece-openai",
] as const;

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
 * Get metadata for all available connectors.
 */
export async function getAvailableConnectors(): Promise<ConnectorMetadata[]> {
  const results = await Promise.all(
    AVAILABLE_CONNECTORS.map(loadConnectorMetadata),
  );
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
