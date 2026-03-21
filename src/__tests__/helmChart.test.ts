/**
 * Helm chart configuration assertions.
 *
 * Verifies that the API deployment template does not contain
 * stale or incorrect environment variable references.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CHART_PATH = resolve(
  import.meta.dir,
  "../../../../charts/vortex/templates/api-deployment.yaml",
);

const chartContent = readFileSync(CHART_PATH, "utf-8");

describe("api-deployment.yaml", () => {
  it("does not contain AETHER_BASE_URL env var", () => {
    expect(chartContent).not.toContain("AETHER_BASE_URL");
  });

  it("contains expected core env vars", () => {
    expect(chartContent).toContain("DATABASE_URL");
    expect(chartContent).toContain("ENCRYPTION_KEY");
    expect(chartContent).toContain("HATCHET_CLIENT_TOKEN");
  });
});
