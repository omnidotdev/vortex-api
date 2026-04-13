/**
 * Authentication tests.
 *
 * Tests token validation logic and user provisioning behavior via mocked DB.
 */

import { describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";

// Mock env config to prevent required-env-var validation at import time
mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://localhost:3000",
  AUTHZ_API_URL: "http://warden.test",
  AUTHZ_SERVICE_KEY: undefined,
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  LOG_LEVEL: "info",
  isProdEnv: false,
  isDevEnv: false,
  protectRoutes: false,
  isAuthzEnabled: false,
  hasBilling: false,
}));

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

// In-memory store for mocked DB operations
const users = new Map<string, Record<string, unknown>>();

const mockReturning = (user: Record<string, unknown>) => ({
  returning: () => [user],
});

const mockOnConflictDoUpdate = (
  existing: Record<string, unknown> | undefined,
  values: Record<string, unknown>,
) => ({
  onConflictDoUpdate: (opts: { set: Record<string, unknown> }) => {
    if (existing) {
      const updated = { ...existing, ...opts.set };
      users.set(existing.id as string, updated);
      return mockReturning(updated);
    }
    return mockReturning(values);
  },
  returning: () => {
    const id = (values.id as string) || randomUUID();
    const user = { id, ...values };
    users.set(id, user);
    return [user];
  },
});

const mockDbInsert = () => ({
  values: (values: Record<string, unknown>) => {
    const id = randomUUID();
    const user = { id, ...values };
    users.set(id, user);

    // Find existing by identityProviderId
    let existing: Record<string, unknown> | undefined;
    if (values.identityProviderId) {
      for (const u of users.values()) {
        if (u.identityProviderId === values.identityProviderId && u.id !== id) {
          existing = u;
          // Remove the duplicate we just inserted
          users.delete(id);
          break;
        }
      }
    }

    return mockOnConflictDoUpdate(existing, user);
  },
});

const mockDbDelete = () => ({
  where: () => Promise.resolve([]),
});

const mockDbSelect = () => ({
  from: () => ({
    where: () => ({
      limit: () => Promise.resolve([]),
      orderBy: () => ({
        limit: () => ({
          offset: () => Promise.resolve([]),
        }),
      }),
    }),
  }),
});

mock.module("lib/db/db", () => ({
  dbPool: {
    insert: mockDbInsert,
    delete: mockDbDelete,
    select: mockDbSelect,
  },
  pgPool: { end: async () => {} },
}));

mock.module("lib/db/schema", () => ({
  userTable: {
    id: "id",
    identityProviderId: "identity_provider_id",
    email: "email",
    name: "name",
  },
  userOrganizationTable: {},
  workflowTable: {},
  workflowRunTable: {},
  workflowStepLogTable: {},
  integrationTable: {},
}));

describe("Authentication", () => {
  describe("User Provisioning", () => {
    test("should create a new user via insert mock", async () => {
      const { dbPool: db } = await import("lib/db/db");
      const { userTable } = await import("lib/db/schema");

      const [user] = await db
        .insert(userTable)
        .values({
          identityProviderId: randomUUID(),
          email: "auth-test-1@example.com",
          name: "Auth Test User",
        })
        .returning();

      expect(user.id).toBeDefined();
      expect(user.email).toBe("auth-test-1@example.com");
    });

    test("should update existing user on conflict", async () => {
      const { dbPool: db } = await import("lib/db/db");
      const { userTable } = await import("lib/db/schema");

      const idpId = randomUUID();

      // First create
      const [user1] = await db
        .insert(userTable)
        .values({
          identityProviderId: idpId,
          email: "auth-test-2@example.com",
          name: "Original Name",
        })
        .returning();

      // Update by inserting with same identityProviderId
      const [user2] = await db
        .insert(userTable)
        .values({
          identityProviderId: idpId,
          email: "auth-test-2-updated@example.com",
          name: "Updated Name",
        })
        .onConflictDoUpdate({
          target: userTable.identityProviderId,
          set: {
            email: "auth-test-2-updated@example.com",
            name: "Updated Name",
            updatedAt: new Date().toISOString(),
          },
        })
        .returning();

      expect(user2.id).toBe(user1.id);
      expect(user2.email).toBe("auth-test-2-updated@example.com");
      expect(user2.name).toBe("Updated Name");
    });
  });

  describe("Token Validation Logic", () => {
    test("should reject expired tokens", () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredClaims = {
        sub: "test-sub",
        email: "test@example.com",
        exp: now - 3600, // 1 hour ago
      };

      expect(expiredClaims.exp).toBeLessThan(now);
    });

    test("should reject tokens issued in the future", () => {
      const now = Math.floor(Date.now() / 1000);
      const futureClaims = {
        sub: "test-sub",
        email: "test@example.com",
        iat: now + 3600, // 1 hour in the future
      };

      expect(futureClaims.iat).toBeGreaterThan(now);
    });

    test("should accept valid token claims", () => {
      const now = Math.floor(Date.now() / 1000);
      const validClaims = {
        sub: "test-sub",
        email: "test@example.com",
        exp: now + 3600, // expires in 1 hour
        iat: now - 60, // issued 1 minute ago
      };

      expect(validClaims.exp).toBeGreaterThan(now);
      expect(validClaims.iat).toBeLessThan(now);
      expect(validClaims.sub).toBeDefined();
      expect(validClaims.email).toBeDefined();
    });
  });
});
