/**
 * OAuth Provider Registry
 *
 * Configuration for supported OAuth2 providers including endpoints,
 * scopes, and provider-specific settings like PKCE requirements.
 */

/** @knipignore - Used by getOAuthProvider return type */
export interface OAuthProviderConfig {
  /** OAuth2 authorization endpoint */
  authorizationUrl: string;
  /** OAuth2 token exchange endpoint */
  tokenUrl: string;
  /** Token revocation endpoint (if supported) */
  revokeUrl?: string;
  /** Default scopes to request */
  defaultScopes: string[];
  /** Whether PKCE is required for this provider */
  pkceRequired: boolean;
  /** Whether the provider supports refresh tokens */
  refreshTokenSupported: boolean;
  /** Additional authorization URL parameters */
  authParams?: Record<string, string>;
}

/**
 * Supported OAuth providers with their configuration.
 * @knipignore - Used by getOAuthProvider
 */
export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    defaultScopes: ["repo", "user:email"],
    pkceRequired: false,
    refreshTokenSupported: false,
  },
  discord: {
    authorizationUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    revokeUrl: "https://discord.com/api/oauth2/token/revoke",
    defaultScopes: ["identify", "guilds"],
    pkceRequired: true,
    refreshTokenSupported: true,
  },
  slack: {
    authorizationUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    revokeUrl: "https://slack.com/api/auth.revoke",
    defaultScopes: ["chat:write", "channels:read"],
    pkceRequired: false,
    refreshTokenSupported: true,
  },
  google: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    defaultScopes: ["https://www.googleapis.com/auth/spreadsheets"],
    pkceRequired: true,
    refreshTokenSupported: true,
    authParams: {
      access_type: "offline",
      prompt: "consent",
    },
  },
};

/**
 * Get OAuth provider configuration.
 * @throws Error if provider is not supported
 */
export function getOAuthProvider(provider: string): OAuthProviderConfig {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
  return config;
}

/**
 * Check if a provider is supported for OAuth.
 */
export function isOAuthProviderSupported(provider: string): boolean {
  return provider in OAUTH_PROVIDERS;
}

/**
 * Get list of supported OAuth provider names.
 * @knipignore - Public API for listing providers
 */
export function getSupportedOAuthProviders(): string[] {
  return Object.keys(OAUTH_PROVIDERS);
}
