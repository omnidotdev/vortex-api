import { describe, expect, it, mock } from "bun:test";

mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://localhost:3000",
  AUTHZ_API_URL: "http://warden.test",
  AUTHZ_SERVICE_KEY: undefined,
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  INTERNAL_API_SECRET: "test-secret",
  WORKER_URL: "http://localhost:4000",
  LOG_LEVEL: "info",
  isProdEnv: false,
  isDevEnv: false,
  protectRoutes: false,
  isAuthzEnabled: false,
  hasBilling: true,
}));

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

mock.module("iovalkey", () => ({
  default: class MockValkey {},
}));

mock.module("lib/cache/client", () => ({
  cacheClient: null,
}));

mock.module("lib/db/db", () => ({
  dbPool: {},
  dbClient: {},
  pgClient: { end: async () => {} },
  pgPool: { end: async () => {} },
}));

mock.module("lib/hatchet/client", () => ({
  pushEvent: async () => {},
  isConfigured: () => false,
}));

mock.module("@temporalio/client", () => ({
  Connection: { connect: async () => ({}) },
  Client: class MockClient {},
}));

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
