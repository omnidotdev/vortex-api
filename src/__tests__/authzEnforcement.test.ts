/**
 * AuthZ and billing enforcement source-code validation tests.
 *
 * Verifies that security-critical routes call the expected
 * authorization and billing enforcement functions. These tests
 * read the source files directly to catch regressions where
 * enforcement calls are accidentally removed.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readSource = (relativePath: string): string =>
  readFileSync(join(import.meta.dirname, "..", relativePath), "utf-8");

describe("DLQ route authorization enforcement", () => {
  const source = readSource("routes/dlq.ts");

  it("should import authorize from lib/warden/authorize", () => {
    expect(source).toContain('import authorize from "lib/warden/authorize"');
  });

  it("should call authorize in the list handler (GET /)", () => {
    // Split source into route handlers and check the GET / handler
    const listHandler = source.split(".get(")[1];
    expect(listHandler).toBeDefined();
    expect(listHandler).toContain("authorize(");
  });

  it("should call authorize in the stats handler (GET /stats)", () => {
    const statsHandler = source.split('"/stats"')[1];
    expect(statsHandler).toBeDefined();
    expect(statsHandler?.split(".get(")[0]).toContain("authorize(");
  });
});

describe("function invocation billing enforcement", () => {
  const source = readSource("routes/functions.ts");

  it("should import isExecutionAllowed", () => {
    expect(source).toContain("isExecutionAllowed");
  });

  it("should check execution limits before function invocation", () => {
    // The invoke handler should call isExecutionAllowed
    const invokeHandler = source.split('"/:id/invoke"')[1];
    expect(invokeHandler).toBeDefined();
    expect(invokeHandler).toContain("isExecutionAllowed");
  });

  it("should record rejected_executions when limit is exceeded", () => {
    const invokeHandler = source.split('"/:id/invoke"')[1];
    expect(invokeHandler).toContain("rejected_executions");
  });
});

describe("all REST routes enforce authentication", () => {
  const routeFiles = [
    "routes/dlq.ts",
    "routes/functions.ts",
    "routes/subscriptions.ts",
    "routes/plugins.ts",
    "routes/marketplace.ts",
  ];

  for (const file of routeFiles) {
    it(`${file} should call resolveAuth`, () => {
      const source = readSource(file);
      expect(source).toContain("resolveAuth");
    });
  }
});
