/**
 * Environment variables with validation.
 *
 * Required variables are validated at startup to fail fast.
 */

// Individual `const X = process.env.X` declarations rather than one
// `const { ... } = process.env` destructuring: `bun build` mangles the
// destructuring pattern under this bundle (it emits TDZ references to the
// bare consts, crashing at boot with `ReferenceError: <VAR> is not defined`).
// Plain const initializers bundle cleanly.
const NODE_ENV = process.env.NODE_ENV;
const PORT = process.env.PORT ?? "4000";
const HOST = process.env.HOST ?? "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_BASE_URL = process.env.AUTH_BASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const GRAPHQL_MAX_COMPLEXITY_COST =
  process.env.GRAPHQL_MAX_COMPLEXITY_COST ?? "5000";
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS;
const AUTH_DEBUG = process.env.AUTH_DEBUG;
const CACHE_URL = process.env.CACHE_URL;
// billing
const BILLING_BASE_URL = process.env.BILLING_BASE_URL;
const BILLING_WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET;
const BILLING_SERVICE_API_KEY = process.env.BILLING_SERVICE_API_KEY;
// PDP authorization
const AUTHZ_API_URL = process.env.AUTHZ_API_URL;
const AUTHZ_SERVICE_KEY = process.env.AUTHZ_SERVICE_KEY;
// AuthZ sync webhook (for receiving tuple sync requests from apps)
const AUTHZ_WEBHOOK_SECRET = process.env.AUTHZ_WEBHOOK_SECRET;
// Search bootstrap webhook (for initializing Meilisearch)
const SEARCH_BOOTSTRAP_WEBHOOK_SECRET =
  process.env.SEARCH_BOOTSTRAP_WEBHOOK_SECRET;
// Audit log webhook (for receiving audit events from apps)
const AUDIT_WEBHOOK_SECRET = process.env.AUDIT_WEBHOOK_SECRET;
// Platform organization (owns built-in event schemas)
const PLATFORM_ORG_ID = process.env.PLATFORM_ORG_ID;
// Chronicle audit-log ingest (CHRONICLE_WEBHOOK_SECRET must match Chronicle's VORTEX_WEBHOOK_SECRET)
const CHRONICLE_API_URL = process.env.CHRONICLE_API_URL;
const CHRONICLE_WEBHOOK_SECRET = process.env.CHRONICLE_WEBHOOK_SECRET;
// Fractal operator billing webhooks: Vortex delivers aether.billing.suspended /
// .suspension_lifted to the operator so paused/suspended workspaces scale to zero
// and resume. In-cluster delivery (operator does not verify HMAC), so the URL
// defaults to the in-cluster service and the secret only needs to be non-empty.
const FRACTAL_OPERATOR_WEBHOOK_URL =
  process.env.FRACTAL_OPERATOR_WEBHOOK_URL ??
  "http://fractal-operator-webhook.fractal-system.svc.cluster.local:8082";
const FRACTAL_OPERATOR_WEBHOOK_SECRET =
  process.env.FRACTAL_OPERATOR_WEBHOOK_SECRET;
// auth webhooks
const AUTH_WEBHOOK_SECRET = process.env.AUTH_WEBHOOK_SECRET;
// IDP webhooks
const IDP_WEBHOOK_SECRET = process.env.IDP_WEBHOOK_SECRET;
// Inbound email webhook (Resend)
const EMAIL_WEBHOOK_SECRET = process.env.EMAIL_WEBHOOK_SECRET;
// OAuth provider credentials
const GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID;
const GITHUB_OAUTH_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET;
const DISCORD_OAUTH_CLIENT_ID = process.env.DISCORD_OAUTH_CLIENT_ID;
const DISCORD_OAUTH_CLIENT_SECRET = process.env.DISCORD_OAUTH_CLIENT_SECRET;
const SLACK_OAUTH_CLIENT_ID = process.env.SLACK_OAUTH_CLIENT_ID;
const SLACK_OAUTH_CLIENT_SECRET = process.env.SLACK_OAUTH_CLIENT_SECRET;
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
// Public URL for OAuth callbacks
const VORTEX_PUBLIC_URL = process.env.VORTEX_PUBLIC_URL;
// Hatchet workflow engine
const HATCHET_CLIENT_TOKEN = process.env.HATCHET_CLIENT_TOKEN;
// Temporal workflow engine
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS;
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE;
const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE;
// Plugin storage (S3-compatible)
const PLUGIN_STORAGE_BUCKET = process.env.PLUGIN_STORAGE_BUCKET;
const PLUGIN_STORAGE_BASE_URL = process.env.PLUGIN_STORAGE_BASE_URL;
// Internal API secret (shared with edge worker)
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
// Worker URL (for proxying execute-step)
const WORKER_URL = process.env.WORKER_URL;

// These module-init computed exports read `process.env` directly rather than
// the destructured consts above. `bun build` bundles server.ts + instrumentation.ts
// together and can order this module's destructuring after another module that
// consumes these exports at its own init, putting the destructured consts in the
// temporal dead zone (`ReferenceError: PROTECT_ROUTES is not defined`). Reading
// the always-available `process.env` global sidesteps that ordering entirely.
export const isDevEnv = process.env.NODE_ENV === "development";
export const isProdEnv = process.env.NODE_ENV === "production";

/** Log level threshold (default: "debug" in dev, "info" in production) */
export const LOG_LEVEL = process.env.LOG_LEVEL ?? (isDevEnv ? "debug" : "info");
export const protectRoutes = isProdEnv || process.env.PROTECT_ROUTES === "true";
export const isAuthzEnabled = !!process.env.AUTHZ_API_URL;
/**
 * Whether billing is available (Aether integration configured).
 * Used to gate billing-dependent startup validation and features.
 */
export const hasBilling = !!process.env.BILLING_BASE_URL;

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
    assertProdEnv("VORTEX_PUBLIC_URL", VORTEX_PUBLIC_URL);
    assertProdEnv("EMAIL_WEBHOOK_SECRET", EMAIL_WEBHOOK_SECRET);
  }

  // Startup warnings for optional integrations
  if (!BILLING_BASE_URL)
    console.warn("BILLING_BASE_URL not set, billing disabled");
  if (!AUTHZ_API_URL)
    console.warn("AUTHZ_API_URL not set, authorization disabled");
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
  // Chronicle audit-log ingest
  CHRONICLE_API_URL,
  CHRONICLE_WEBHOOK_SECRET,
  CORS_ALLOWED_ORIGINS,
  DATABASE_URL,
  DISCORD_OAUTH_CLIENT_ID,
  DISCORD_OAUTH_CLIENT_SECRET,
  // Inbound email webhook (Resend)
  EMAIL_WEBHOOK_SECRET,
  ENCRYPTION_KEY,
  FRACTAL_OPERATOR_WEBHOOK_SECRET,
  // Fractal operator billing webhook delivery
  FRACTAL_OPERATOR_WEBHOOK_URL,
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
  // Search bootstrap webhook
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET,
  SLACK_OAUTH_CLIENT_ID,
  SLACK_OAUTH_CLIENT_SECRET,
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
