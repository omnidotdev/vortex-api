/**
 * Global test setup for Bun test runner.
 *
 * This file is automatically loaded by Bun when running tests.
 * Uses dynamic import to avoid eagerly loading `lib/db/db`, which
 * would break test isolation when other files mock that module.
 */

import { afterAll } from "bun:test";

afterAll(async () => {
  try {
    const { pgPool } = await import("lib/db/db");
    await pgPool.end();
  } catch {
    // Module may be mocked in unit tests
  }
});
