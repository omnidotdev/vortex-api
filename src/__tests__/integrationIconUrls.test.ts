/**
 * Integration definition icon URL validation.
 *
 * Ensures every featured integration definition has a well-formed icon URL.
 * The network-dependent suite (HEAD requests) is tagged as an integration test
 * and can be skipped in CI by filtering to unit tests only.
 */

import { describe, expect, it } from "bun:test";

import { featuredIntegrationDefinitions } from "lib/db/seeds/integrationDefinitions.seed";

const defsWithIcons = featuredIntegrationDefinitions.filter(
  (d) => "iconUrl" in d && d.iconUrl,
);

describe("integration definition icon URLs", () => {
  it("every definition has an iconUrl", () => {
    for (const def of featuredIntegrationDefinitions) {
      expect(def.iconUrl).toBeTruthy();
    }
  });

  it("all iconUrls are well-formed HTTPS URLs", () => {
    for (const def of defsWithIcons) {
      const url = new URL(def.iconUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBeTruthy();
    }
  });

  it("no iconUrls contain whitespace or control characters", () => {
    for (const def of defsWithIcons) {
      // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional check for control chars in URLs
      expect(def.iconUrl).not.toMatch(/[\s\x00-\x1f]/);
    }
  });

  it("all iconUrls end with a valid image path or CDN endpoint", () => {
    for (const def of defsWithIcons) {
      const url = new URL(def.iconUrl);
      // Must have a non-empty pathname (not just "/")
      expect(url.pathname.length).toBeGreaterThan(1);
    }
  });
});

describe("integration definition icon URLs (network)", () => {
  for (const def of defsWithIcons) {
    it(`${def.id}: icon URL returns HTTP 200`, async () => {
      const res = await fetch(def.iconUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(10_000),
      });

      expect(res.ok).toBe(true);
    });
  }
});
