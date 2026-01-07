/**
 * Global test setup for Bun test runner.
 *
 * This file is automatically loaded by Bun when running tests.
 */

import { afterAll, beforeAll } from "bun:test";

import { pgPool } from "lib/db/db";

beforeAll(async () => {
  // Ensure database connection is ready
  // Tests will use the same database as development
  // Consider using a separate test database in production CI/CD
});

afterAll(async () => {
  // Close database connections
  await pgPool.end();
});
