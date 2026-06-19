import { describe, expect, it, mock } from "bun:test";

// The only module mocked here is the catalog fetcher, which otherwise hits the
// npm registry / vortex-worker filesystem. It is mocked by no other test file,
// so there is no cross-file mock leakage. Importing routes/internal is
// otherwise side-effect-free (it boots no server and opens no connections), and
// INTERNAL_API_SECRET is provided by the test preload
const mockCatalog = {
  generatedAt: "2026-03-22T04:00:00.000Z",
  total: 2,
  entries: [
    {
      id: "github",
      name: "Github",
      description: "GitHub integration",
      category: "developer",
      mcpPackage: "@activepieces/piece-github",
      npmUrl: "https://www.npmjs.com/package/@activepieces/piece-github",
      version: "1.0.0",
      lastUpdated: "2026-03-22T00:00:00.000Z",
    },
    {
      id: "slack",
      name: "Slack",
      description: "Slack integration",
      category: "communication",
      mcpPackage: "@activepieces/piece-slack",
      npmUrl: "https://www.npmjs.com/package/@activepieces/piece-slack",
      version: "2.0.0",
      lastUpdated: "2026-03-22T00:00:00.000Z",
    },
  ],
};

mock.module("lib/integrations/catalogSync", () => ({
  default: async () => mockCatalog,
}));

describe("POST /api/v1/internal/catalog/sync", () => {
  it("returns 401 without valid authorization", async () => {
    const { default: internalRoutes } = await import("routes/internal");
    const { Elysia } = await import("elysia");
    const app = new Elysia().use(internalRoutes);

    const response = await app.handle(
      new Request("http://localhost/internal/catalog/sync", { method: "POST" }),
    );
    expect(response.status).toBe(401);
  });

  it("returns catalog JSON with valid authorization", async () => {
    const { default: internalRoutes } = await import("routes/internal");
    const { Elysia } = await import("elysia");
    const app = new Elysia().use(internalRoutes);

    const response = await app.handle(
      new Request("http://localhost/internal/catalog/sync", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(2);
    expect(body.entries).toHaveLength(2);
    expect(body.generatedAt).toBe("2026-03-22T04:00:00.000Z");
  });
});
