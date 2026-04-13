/**
 * OAuth Token Operations
 *
 * Handles token exchange, refresh, revocation, and retrieval.
 * All tokens are encrypted at rest using AES-256-GCM.
 */

import { and, eq, lt } from "drizzle-orm";

import { VORTEX_PUBLIC_URL, getOAuthCredentials } from "lib/config/env.config";
import { decrypt, encrypt } from "lib/crypto/encryption";
import { dbPool as db } from "lib/db/db";
import { integrationTable, oauthTokenTable } from "lib/db/schema";
import { getOAuthProvider } from "./providers";

/** @knipignore - Used by exchangeCodeForTokens return type */
export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope: string;
  expiresIn?: number;
}

/** @knipignore - Used by getDecryptedToken return type */
export interface StoredToken {
  id: string;
  integrationId: string;
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scope: string;
  expiresAt: string | null;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  provider: string,
  code: string,
  codeVerifier: string | null,
  redirectUri: string,
): Promise<TokenResponse> {
  const credentials = getOAuthCredentials(provider);
  if (!credentials) {
    throw new Error(`OAuth not configured for provider: ${provider}`);
  }

  const providerConfig = getOAuthProvider(provider);

  // Build token request body
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  // Add code verifier for PKCE
  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  // Make token exchange request
  const response = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Handle GitHub's non-standard response format
  if (provider === "github" && typeof data === "string") {
    const params = new URLSearchParams(data);
    return {
      accessToken: params.get("access_token") ?? "",
      tokenType: params.get("token_type") ?? "bearer",
      scope: params.get("scope") ?? "",
    };
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || "Bearer",
    scope: data.scope || "",
    expiresIn: data.expires_in,
  };
}

/**
 * Store OAuth tokens for an integration.
 * Tokens are encrypted before storage.
 */
export async function storeTokens(
  integrationId: string,
  organizationId: string,
  provider: string,
  tokens: TokenResponse,
): Promise<string> {
  // Calculate expiration time if provided
  let expiresAt: string | null = null;
  if (tokens.expiresIn) {
    expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
  }

  // Insert encrypted tokens
  const [inserted] = await db
    .insert(oauthTokenTable)
    .values({
      integrationId,
      organizationId,
      provider,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenType: tokens.tokenType,
      scope: tokens.scope,
      expiresAt,
    })
    .returning({ id: oauthTokenTable.id });

  // Update integration OAuth status
  await db
    .update(integrationTable)
    .set({
      authMethod: "oauth",
      oauthStatus: "connected",
      oauthConnectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationTable.id, integrationId));

  return inserted.id;
}

/**
 * Get decrypted tokens for an integration.
 * Used during workflow execution to make authenticated API calls.
 * @knipignore - Used by workflow executor
 */
export async function getDecryptedToken(
  integrationId: string,
): Promise<StoredToken | null> {
  const token = await db.query.oauthTokenTable.findFirst({
    where: eq(oauthTokenTable.integrationId, integrationId),
  });

  if (!token) {
    return null;
  }

  return {
    id: token.id,
    integrationId: token.integrationId,
    provider: token.provider,
    accessToken: decrypt(token.accessToken),
    refreshToken: token.refreshToken ? decrypt(token.refreshToken) : null,
    tokenType: token.tokenType,
    scope: token.scope,
    expiresAt: token.expiresAt,
  };
}

/**
 * Refresh an access token using the refresh token.
 * Updates the stored tokens with the new values.
 * @knipignore - Used by token refresh workflow
 */
export async function refreshAccessToken(tokenId: string): Promise<boolean> {
  const token = await db.query.oauthTokenTable.findFirst({
    where: eq(oauthTokenTable.id, tokenId),
  });

  if (!token || !token.refreshToken) {
    return false;
  }

  const credentials = getOAuthCredentials(token.provider);
  if (!credentials) {
    return false;
  }

  const providerConfig = getOAuthProvider(token.provider);
  if (!providerConfig.refreshTokenSupported) {
    return false;
  }

  // Decrypt the refresh token
  const refreshToken = decrypt(token.refreshToken);

  // Build refresh request
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  try {
    const response = await fetch(providerConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      // Mark integration as expired
      await db
        .update(integrationTable)
        .set({
          oauthStatus: "expired",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(integrationTable.id, token.integrationId));
      return false;
    }

    const data = await response.json();

    // Calculate new expiration
    let expiresAt: string | null = null;
    if (data.expires_in) {
      expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
    }

    // Update stored tokens
    await db
      .update(oauthTokenTable)
      .set({
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token
          ? encrypt(data.refresh_token)
          : token.refreshToken,
        expiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(oauthTokenTable.id, tokenId));

    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke an OAuth token at the provider.
 */
export async function revokeToken(tokenId: string): Promise<boolean> {
  const token = await db.query.oauthTokenTable.findFirst({
    where: eq(oauthTokenTable.id, tokenId),
  });

  if (!token) {
    return false;
  }

  const credentials = getOAuthCredentials(token.provider);
  const providerConfig = getOAuthProvider(token.provider);

  // Try to revoke at provider if endpoint is available
  if (providerConfig.revokeUrl && credentials) {
    const accessToken = decrypt(token.accessToken);

    try {
      await fetch(providerConfig.revokeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: accessToken,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }).toString(),
      });
    } catch {
      // Continue with local deletion even if revocation fails
    }
  }

  // Delete token from database
  await db.delete(oauthTokenTable).where(eq(oauthTokenTable.id, tokenId));

  // Update integration status
  await db
    .update(integrationTable)
    .set({
      oauthStatus: null,
      oauthConnectedAt: null,
      authMethod: "manual",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationTable.id, token.integrationId));

  return true;
}

/**
 * Get tokens that are expiring soon and need refresh.
 * Returns tokens expiring within the specified window (default 30 minutes).
 * @knipignore - Used by token refresh workflow
 */
export async function getExpiringTokens(
  windowMinutes = 30,
): Promise<{ id: string; integrationId: string; provider: string }[]> {
  const cutoff = new Date(Date.now() + windowMinutes * 60 * 1000);

  const tokens = await db.query.oauthTokenTable.findMany({
    where: and(
      lt(oauthTokenTable.expiresAt, cutoff.toISOString()),
      // Only get tokens that have refresh tokens
      // This is a simplification - in practice you'd use isNotNull()
    ),
    columns: {
      id: true,
      integrationId: true,
      provider: true,
      refreshToken: true,
    },
  });

  // Filter to only those with refresh tokens
  return tokens
    .filter((t) => t.refreshToken !== null)
    .map((t) => ({
      id: t.id,
      integrationId: t.integrationId,
      provider: t.provider,
    }));
}

/**
 * Build the OAuth callback URL for a provider.
 */
export function getOAuthCallbackUrl(provider: string): string {
  const baseUrl = VORTEX_PUBLIC_URL || "http://localhost:4222";
  return `${baseUrl}/api/v1/oauth/${provider}/callback`;
}
