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
  GRAPHQL_COMPLEXITY_MAX_COST,
  CORS_ALLOWED_ORIGINS,
  PROTECT_ROUTES,
  AUTH_DEBUG,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  REDIS_URL,
  // Aether entitlements
  ENTITLEMENTS_BASE_URL,
  ENTITLEMENTS_WEBHOOK_SECRET,
  AETHER_SERVICE_API_KEY,
  // PDP authorization
  AUTHZ_ENABLED,
  AUTHZ_PROVIDER_URL,
  // Self-hosted mode
  SELF_HOSTED,
  // IDP webhooks
  IDP_WEBHOOK_SECRET,
} = process.env;

export const isDevEnv = NODE_ENV === "development";
export const isProdEnv = NODE_ENV === "production";
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

// Validate production-only requirements
assertProdEnv("ENCRYPTION_KEY", ENCRYPTION_KEY);
assertProdEnv("STRIPE_API_KEY", STRIPE_API_KEY);
assertProdEnv("STRIPE_WEBHOOK_SECRET", STRIPE_WEBHOOK_SECRET);
assertProdEnv("REDIS_URL", REDIS_URL);

// Export validated variables
export {
  NODE_ENV,
  PORT,
  HOST,
  DATABASE_URL,
  AUTH_BASE_URL,
  ENCRYPTION_KEY,
  GRAPHQL_COMPLEXITY_MAX_COST,
  CORS_ALLOWED_ORIGINS,
  PROTECT_ROUTES,
  AUTH_DEBUG,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  REDIS_URL,
  // Aether entitlements
  ENTITLEMENTS_BASE_URL,
  ENTITLEMENTS_WEBHOOK_SECRET,
  AETHER_SERVICE_API_KEY,
  // PDP authorization
  AUTHZ_ENABLED,
  AUTHZ_PROVIDER_URL,
  // Self-hosted mode
  SELF_HOSTED,
  // IDP webhooks
  IDP_WEBHOOK_SECRET,
};
