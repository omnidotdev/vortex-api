/**
 * Global test setup for Bun test runner.
 *
 * Preloaded by Bun (see bunfig.toml) before any test file is evaluated, so the
 * hermetic environment below is in place by the time modules read `process.env`
 * at import. Defaults use `??=` so an explicit `--env-file` (the integration
 * lane) still wins.
 *
 * `lib/config/env.config` no longer validates at import (see `validateEnv`), so
 * setting the required vars here is only to give the suite deterministic config
 * values. `AUTHZ_API_URL` / `BILLING_BASE_URL` / `CACHE_URL` are intentionally
 * left unset so the authz, billing, and cache clients resolve to null and their
 * feature flags are false; tests that exercise the enabled paths inject those
 * dependencies explicitly rather than mutating the environment.
 */

import { afterAll } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/vortex_test";
process.env.AUTH_BASE_URL ??= "http://auth.test";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost";
process.env.HATCHET_CLIENT_TOKEN ??= "test-token";
process.env.INTERNAL_API_SECRET ??= "test-secret";
process.env.LOG_LEVEL ??= "silent";

afterAll(async () => {
  try {
    const { pgPool } = await import("lib/db/db");
    await pgPool.end();
  } catch {
    // Pool may never have connected (unit tests inject their own db)
  }
});
