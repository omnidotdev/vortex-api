/**
 * Environment variables with validation.
 *
 * Required variables are validated at startup to fail fast.
 */

const {
  NODE_ENV,
  PORT = "4000",
  HOST = "0.0.0.0",
  DATABASE_URL,
  AUTH_BASE_URL,
  ENCRYPTION_KEY,
  GRAPHQL_MAX_COMPLEXITY_COST = "5000",
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
  AUTHZ_API_URL,
  AUTHZ_SERVICE_KEY,
  // AuthZ sync webhook (for receiving tuple sync requests from apps)
  AUTHZ_WEBHOOK_SECRET,
  // Search bootstrap webhook (for initializing Meilisearch)
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET,
  // Audit log webhook (for receiving audit events from apps)
  AUDIT_WEBHOOK_SECRET,
  // Platform organization (owns built-in event schemas)
  PLATFORM_ORG_ID,
  // auth webhooks
  AUTH_WEBHOOK_SECRET,
  // IDP webhooks
  IDP_WEBHOOK_SECRET,
  // Inbound email webhook (Resend)
  EMAIL_WEBHOOK_SECRET,
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
  // Worker URL (for proxying execute-step)
  WORKER_URL,
  // Logging
  LOG_LEVEL: LOG_LEVEL_RAW,
} = process.env;

export const isDevEnv = NODE_ENV === "development";
export const isProdEnv = NODE_ENV === "production";

/** Log level threshold (default: "debug" in dev, "info" in production) */
export const LOG_LEVEL = LOG_LEVEL_RAW ?? (isDevEnv ? "debug" : "info");
export const protectRoutes = isProdEnv || PROTECT_ROUTES === "true";
export const isAuthzEnabled = !!AUTHZ_API_URL;
/**
 * Whether billing is available (Aether integration configured).
 * Used to gate billing-dependent startup validation and features.
 */
export const hasBilling = !!BILLING_BASE_URL;

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

/**
 * Validate required environment variables and emit startup warnings for
 * optional integrations.
 *
 * Called explicitly from runtime entrypoints (e.g. the server bootstrap) rather
 * than at import time, so importing this module has no side effects. This keeps
 * the module import-safe for tests, which can read the exported config without
 * supplying a full production environment.
 */
export function validateEnv(): void {
  // Validate required environment variables
  assertEnv("DATABASE_URL", DATABASE_URL);
  assertEnv("AUTH_BASE_URL", AUTH_BASE_URL);
  assertEnv("CORS_ALLOWED_ORIGINS", CORS_ALLOWED_ORIGINS);
  assertEnv("HATCHET_CLIENT_TOKEN", HATCHET_CLIENT_TOKEN);

  // Validate production-only requirements
  assertProdEnv("ENCRYPTION_KEY", ENCRYPTION_KEY);
  assertProdEnv("CACHE_URL", CACHE_URL);
  assertProdEnv("INTERNAL_API_SECRET", INTERNAL_API_SECRET);

  // Billing-dependent requirements (skip when billing is not configured)
  if (hasBilling) {
    assertProdEnv("STRIPE_API_KEY", STRIPE_API_KEY);
    assertProdEnv("STRIPE_WEBHOOK_SECRET", STRIPE_WEBHOOK_SECRET);
    assertProdEnv("VORTEX_PUBLIC_URL", VORTEX_PUBLIC_URL);
    assertProdEnv("EMAIL_WEBHOOK_SECRET", EMAIL_WEBHOOK_SECRET);
  }

  // Startup warnings for optional integrations
  if (!BILLING_BASE_URL)
    console.warn("BILLING_BASE_URL not set, billing disabled");
  if (!AUTHZ_API_URL)
    console.warn("AUTHZ_API_URL not set, authorization disabled");
  if (!STRIPE_API_KEY)
    console.warn("STRIPE_API_KEY not set, payment processing disabled");
  if (!CACHE_URL)
    console.warn("CACHE_URL not set, distributed caching disabled");
  if (!WORKER_URL)
    console.warn("WORKER_URL not set, step execution proxy disabled");
  if (!PLUGIN_STORAGE_BUCKET)
    console.warn("PLUGIN_STORAGE_BUCKET not set, plugin storage disabled");
}

// Export validated variables
export {
  // Audit log webhook
  AUDIT_WEBHOOK_SECRET,
  AUTHZ_API_URL,
  // Warden service key (for authZ permission checks)
  AUTHZ_SERVICE_KEY,
  // AuthZ sync webhook
  AUTHZ_WEBHOOK_SECRET,
  AUTH_BASE_URL,
  AUTH_DEBUG,
  // auth webhooks
  AUTH_WEBHOOK_SECRET,
  // billing
  BILLING_BASE_URL,
  BILLING_SERVICE_API_KEY,
  BILLING_WEBHOOK_SECRET,
  CACHE_URL,
  CORS_ALLOWED_ORIGINS,
  DATABASE_URL,
  DISCORD_OAUTH_CLIENT_ID,
  DISCORD_OAUTH_CLIENT_SECRET,
  // Inbound email webhook (Resend)
  EMAIL_WEBHOOK_SECRET,
  ENCRYPTION_KEY,
  // OAuth provider credentials
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GRAPHQL_MAX_COMPLEXITY_COST,
  // Hatchet workflow engine
  HATCHET_CLIENT_TOKEN,
  HOST,
  // IDP webhooks
  IDP_WEBHOOK_SECRET,
  // Internal API secret (shared with edge worker)
  INTERNAL_API_SECRET,
  NODE_ENV,
  // Platform organization (owns built-in event schemas)
  PLATFORM_ORG_ID,
  PLUGIN_STORAGE_BASE_URL,
  // Plugin storage (S3-compatible)
  PLUGIN_STORAGE_BUCKET,
  PORT,
  PROTECT_ROUTES,
  // Search bootstrap webhook
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET,
  SLACK_OAUTH_CLIENT_ID,
  SLACK_OAUTH_CLIENT_SECRET,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  // Temporal workflow engine
  TEMPORAL_ADDRESS,
  TEMPORAL_NAMESPACE,
  TEMPORAL_TASK_QUEUE,
  // Public URL for OAuth callbacks
  VORTEX_PUBLIC_URL,
  // Worker URL (for proxying execute-step)
  WORKER_URL,
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
