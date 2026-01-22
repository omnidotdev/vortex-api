/**
 * OAuth State Management
 *
 * Handles creation and validation of OAuth state parameters
 * for CSRF protection during the authorization flow.
 */

import { randomBytes } from "node:crypto";

import { and, eq, gt, lt } from "drizzle-orm";

import { encrypt } from "lib/crypto/encryption";
import { dbPool as db } from "lib/db/db";
import { oauthStateTable } from "lib/db/schema";
import { generatePkcePair } from "./pkce";
import { getOAuthProvider } from "./providers";

/** State expiration time in minutes */
const STATE_TTL_MINUTES = 10;

/** @knipignore - Used by createOAuthState parameter type */
export interface CreateStateParams {
  organizationId: string;
  provider: string;
  definitionId: string;
  scopes?: string[];
  redirectUri: string;
  returnUrl?: string;
}

/** @knipignore - Used by validateOAuthState return type */
export interface OAuthStateRecord {
  id: string;
  state: string;
  organizationId: string;
  provider: string;
  definitionId: string;
  codeVerifier: string | null;
  redirectUri: string;
  scopes: string[];
  returnUrl: string | null;
}

/**
 * Create a new OAuth state for CSRF protection.
 * Returns the state parameter to include in the authorization URL.
 */
export async function createOAuthState(
  params: CreateStateParams,
): Promise<{ state: string; codeChallenge: string | null }> {
  const {
    organizationId,
    provider,
    definitionId,
    scopes,
    redirectUri,
    returnUrl,
  } = params;

  // Generate random state parameter (32 bytes = 43 base64url chars)
  const state = randomBytes(32).toString("base64url");

  // Check if PKCE is required for this provider
  const providerConfig = getOAuthProvider(provider);
  let codeVerifier: string | null = null;
  let codeChallenge: string | null = null;

  if (providerConfig.pkceRequired) {
    const pkce = generatePkcePair();
    codeVerifier = pkce.verifier;
    codeChallenge = pkce.challenge;
  }

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);

  // Get final scopes (use provided or default)
  const finalScopes = scopes ?? providerConfig.defaultScopes;

  // Store state in database
  await db.insert(oauthStateTable).values({
    state,
    organizationId,
    provider,
    definitionId,
    codeVerifier: codeVerifier ? encrypt(codeVerifier) : null,
    codeChallenge,
    redirectUri,
    scopes: finalScopes,
    returnUrl,
    expiresAt: expiresAt.toISOString(),
  });

  return { state, codeChallenge };
}

/**
 * Validate and consume an OAuth state.
 * Returns the state record if valid, throws if invalid or expired.
 * State is deleted after validation (one-time use).
 */
export async function validateOAuthState(
  state: string,
): Promise<OAuthStateRecord> {
  // Find the state record
  const record = await db.query.oauthStateTable.findFirst({
    where: and(
      eq(oauthStateTable.state, state),
      gt(oauthStateTable.expiresAt, new Date().toISOString()),
    ),
  });

  if (!record) {
    throw new Error("Invalid or expired OAuth state");
  }

  // Delete the state (one-time use)
  await db.delete(oauthStateTable).where(eq(oauthStateTable.id, record.id));

  return {
    id: record.id,
    state: record.state,
    organizationId: record.organizationId,
    provider: record.provider,
    definitionId: record.definitionId,
    codeVerifier: record.codeVerifier,
    redirectUri: record.redirectUri,
    scopes: record.scopes,
    returnUrl: record.returnUrl,
  };
}

/**
 * Clean up expired OAuth states.
 * Should be called periodically to prevent table bloat.
 * @knipignore - Called by scheduled cleanup job
 */
export async function cleanupExpiredStates(): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .delete(oauthStateTable)
    .where(lt(oauthStateTable.expiresAt, now));

  return result.rowCount ?? 0;
}
