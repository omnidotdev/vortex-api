/**
 * Webhook secret handling tests (P1).
 *
 * - The workflow webhook must accept the secret from an `x-webhook-secret`
 *   header rather than only the URL path (secrets in URLs leak into access
 *   logs, browser history, and Referer headers).
 * - The authz reconcile routes must compare the internal service key with a
 *   constant-time comparison, never a plain `!==`.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readSource = (relativePath: string): string =>
  readFileSync(join(import.meta.dirname, "..", "..", relativePath), "utf-8");

describe("workflow webhook accepts the secret in a header", () => {
  const source = readSource("webhooks.ts");

  it("exposes the header-based route", () => {
    expect(source).toContain('"/workflow/:workflowId"');
  });

  it("reads the secret from the x-webhook-secret header", () => {
    expect(source).toContain('headers["x-webhook-secret"]');
  });

  it("keeps the deprecated path route for backwards compatibility", () => {
    expect(source).toContain('"/workflow/:workflowId/:secret"');
  });
});

describe("authz reconcile uses a constant-time service-key compare", () => {
  const source = readSource("routes/authz.ts");

  it("imports the timing-safe secretsMatch helper", () => {
    expect(source).toContain(
      'import secretsMatch from "lib/crypto/secretsMatch"',
    );
  });

  it("no longer compares the service key with a plain !==", () => {
    expect(source).not.toContain("serviceKey !== AUTHZ_SERVICE_KEY");
  });

  it("routes the check through the timing-safe helper", () => {
    expect(source).toContain("isValidServiceKey");
    expect(source).toMatch(/secretsMatch\(provided, AUTHZ_SERVICE_KEY\)/);
  });
});
