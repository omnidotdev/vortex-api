/**
 * Global test setup for Bun test runner.
 *
 * Preloaded by Bun (see bunfig.toml) before any test file is evaluated, so the
 * hermetic environment below is in place by the time modules read `process.env`
 * at import. `lib/config/env.config` no longer validates at import (see
 * `validateEnv`), so setting the required vars here only gives the suite
 * deterministic config values; defaults use `??=` so an explicit environment
 * can still override them.
 */

import { afterAll } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/vortex_test";
process.env.AUTH_BASE_URL ??= "http://auth.test";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost";
process.env.HATCHET_CLIENT_TOKEN ??= "test-token";
process.env.INTERNAL_API_SECRET ??= "test-secret";
process.env.LOG_LEVEL ??= "silent";

// Force the optional integrations off so the unit suite is deterministic
// regardless of the ambient environment (CI sets some of these). Billing,
// authz, and cache clients then resolve to null and their feature flags are
// false; tests that exercise the enabled paths inject those dependencies
// explicitly rather than relying on the environment
for (const key of ["BILLING_BASE_URL", "AUTHZ_API_URL", "CACHE_URL"]) {
  delete process.env[key];
}

afterAll(async () => {
  try {
    const { pgPool } = await import("lib/db/db");
    await pgPool.end();
  } catch {
    // Pool may never have connected (unit tests inject their own db)
  }
});
