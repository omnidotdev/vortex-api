/**
 * Environment variables with validation.
 *
 * Required variables are validated at startup to fail fast.
 */

const {
  NODE_ENV,
  PORT = "4222",
  HOST = "0.0.0.0",
  DATABASE_URL,
  AUTH_BASE_URL,
  ENCRYPTION_KEY,
  GRAPHQL_MAX_COMPLEXITY_COST,
  CORS_ALLOWED_ORIGINS,
  PROTECT_ROUTES,
  AUTH_DEBUG,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  CACHE_URL,
  // billing
  BILLING_BASE_URL,
  BILLING_WEBHOOK_SECRET,
  BILLING_SERVICE_API_KEY,
  // PDP authorization
  AUTHZ_ENABLED,
  AUTHZ_API_URL,
  // AuthZ sync webhook (for receiving tuple sync requests from apps)
  AUTHZ_WEBHOOK_SECRET,
  // Search bootstrap webhook (for initializing Meilisearch)
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET,
  // Audit log webhook (for receiving audit events from apps)
  AUDIT_WEBHOOK_SECRET,
  // Self-hosted mode
  SELF_HOSTED,
  // auth webhooks
  AUTH_WEBHOOK_SECRET,
  // aether (entitlements)
  AETHER_BASE_URL,
  // aether webhooks
  AETHER_WEBHOOK_SECRET,
  // IDP webhooks
  IDP_WEBHOOK_SECRET,
  // OAuth provider credentials
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET,
  DISCORD_OAUTH_CLIENT_ID,
  DISCORD_OAUTH_CLIENT_SECRET,
  SLACK_OAUTH_CLIENT_ID,
  SLACK_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  // Public URL for OAuth callbacks
  VORTEX_PUBLIC_URL,
  // Hatchet workflow engine
  HATCHET_CLIENT_TOKEN,
  // Temporal workflow engine
  TEMPORAL_ADDRESS,
  TEMPORAL_NAMESPACE,
  TEMPORAL_TASK_QUEUE,
  // Plugin storage (S3-compatible)
  PLUGIN_STORAGE_BUCKET,
  PLUGIN_STORAGE_BASE_URL,
  // Internal API secret (shared with edge worker)
  INTERNAL_API_SECRET,
  // Logging
  LOG_LEVEL: LOG_LEVEL_RAW,
} = process.env;

export const isDevEnv = NODE_ENV === "development";
export const isProdEnv = NODE_ENV === "production";

/** Log level threshold (default: "debug" in dev, "info" in production) */
export const LOG_LEVEL = LOG_LEVEL_RAW ?? (isDevEnv ? "debug" : "info");
export const protectRoutes = isProdEnv || PROTECT_ROUTES === "true";
export const isAuthzEnabled = AUTHZ_ENABLED === "true";
export const isSelfHosted = SELF_HOSTED === "true";

/**
 * Assert that a required environment variable is set.
 */
function assertEnv(
  name: string,
  value: string | undefined,
): asserts value is string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

/**
 * Assert that required environment variables are set in production.
 */
function assertProdEnv(name: string, value: string | undefined): void {
  if (isProdEnv && !value) {
    throw new Error(
      `Missing required environment variable for production: ${name}`,
    );
  }
}

// Validate required environment variables
assertEnv("DATABASE_URL", DATABASE_URL);
assertEnv("AUTH_BASE_URL", AUTH_BASE_URL);
assertEnv("CORS_ALLOWED_ORIGINS", CORS_ALLOWED_ORIGINS);
assertEnv("HATCHET_CLIENT_TOKEN", HATCHET_CLIENT_TOKEN);

// Validate production-only requirements
assertProdEnv("ENCRYPTION_KEY", ENCRYPTION_KEY);
assertProdEnv("STRIPE_API_KEY", STRIPE_API_KEY);
assertProdEnv("STRIPE_WEBHOOK_SECRET", STRIPE_WEBHOOK_SECRET);
assertProdEnv("CACHE_URL", CACHE_URL);

// Export validated variables
export {
  NODE_ENV,
  PORT,
  HOST,
  DATABASE_URL,
  AUTH_BASE_URL,
  ENCRYPTION_KEY,
  GRAPHQL_MAX_COMPLEXITY_COST,
  CORS_ALLOWED_ORIGINS,
  PROTECT_ROUTES,
  AUTH_DEBUG,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  CACHE_URL,
  // billing
  BILLING_BASE_URL,
  BILLING_WEBHOOK_SECRET,
  BILLING_SERVICE_API_KEY,
  // PDP authorization
  AUTHZ_ENABLED,
  AUTHZ_API_URL,
  // AuthZ sync webhook
  AUTHZ_WEBHOOK_SECRET,
  // Search bootstrap webhook
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET,
  // Audit log webhook
  AUDIT_WEBHOOK_SECRET,
  // Self-hosted mode
  SELF_HOSTED,
  // auth webhooks
  AUTH_WEBHOOK_SECRET,
  // aether (entitlements)
  AETHER_BASE_URL,
  // aether webhooks
  AETHER_WEBHOOK_SECRET,
  // IDP webhooks
  IDP_WEBHOOK_SECRET,
  // OAuth provider credentials
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET,
  DISCORD_OAUTH_CLIENT_ID,
  DISCORD_OAUTH_CLIENT_SECRET,
  SLACK_OAUTH_CLIENT_ID,
  SLACK_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  // Public URL for OAuth callbacks
  VORTEX_PUBLIC_URL,
  // Hatchet workflow engine
  HATCHET_CLIENT_TOKEN,
  // Temporal workflow engine
  TEMPORAL_ADDRESS,
  TEMPORAL_NAMESPACE,
  TEMPORAL_TASK_QUEUE,
  // Plugin storage (S3-compatible)
  PLUGIN_STORAGE_BUCKET,
  PLUGIN_STORAGE_BASE_URL,
  // Internal API secret (shared with edge worker)
  INTERNAL_API_SECRET,
};

/**
 * Get OAuth credentials for a provider.
 * Returns null if credentials are not configured.
 */
export function getOAuthCredentials(
  provider: string,
): { clientId: string; clientSecret: string } | null {
  const credentials: Record<
    string,
    { clientId?: string; clientSecret?: string }
  > = {
    github: {
      clientId: GITHUB_OAUTH_CLIENT_ID,
      clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
    },
    discord: {
      clientId: DISCORD_OAUTH_CLIENT_ID,
      clientSecret: DISCORD_OAUTH_CLIENT_SECRET,
    },
    slack: {
      clientId: SLACK_OAUTH_CLIENT_ID,
      clientSecret: SLACK_OAUTH_CLIENT_SECRET,
    },
    google: {
      clientId: GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    },
  };

  const creds = credentials[provider];
  if (!creds?.clientId || !creds?.clientSecret) {
    return null;
  }

  return { clientId: creds.clientId, clientSecret: creds.clientSecret };
}
