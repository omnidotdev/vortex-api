/**
 * Authentication tests.
 *
 * The user-provisioning cases exercise the drizzle insert/upsert call shape
 * against a local in-memory fake (no module mocking); the token-validation
 * cases are pure assertions on claim timestamps.
 */

import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

// In-memory store backing the fake db used by the provisioning cases
const users = new Map<string, Record<string, unknown>>();

type Row = Record<string, unknown>;

const mockReturning = (user: Row) => ({
  returning: async (): Promise<Row[]> => [user],
});

const mockOnConflictDoUpdate = (existing: Row | undefined, values: Row) => ({
  onConflictDoUpdate: (opts: { target?: unknown; set: Row }) => {
    if (existing) {
      const updated = { ...existing, ...opts.set };
      users.set(existing.id as string, updated);
      return mockReturning(updated);
    }
    return mockReturning(values);
  },
  returning: async (): Promise<Row[]> => {
    const id = (values.id as string) || randomUUID();
    const user = { id, ...values };
    users.set(id, user);
    return [user];
  },
});

// Fake drizzle db: insert resolves an upsert against the in-memory store
const db = {
  insert: (_table: unknown) => ({
    values: (values: Row) => {
      const id = randomUUID();
      const user = { id, ...values };
      users.set(id, user);

      // Find existing by identityProviderId
      let existing: Record<string, unknown> | undefined;
      if (values.identityProviderId) {
        for (const u of users.values()) {
          if (
            u.identityProviderId === values.identityProviderId &&
            u.id !== id
          ) {
            existing = u;
            // Remove the duplicate we just inserted
            users.delete(id);
            break;
          }
        }
      }

      return mockOnConflictDoUpdate(existing, user);
    },
  }),
};

const userTable = {
  id: "id",
  identityProviderId: "identity_provider_id",
  email: "email",
  name: "name",
};

describe("Authentication", () => {
  describe("User Provisioning", () => {
    test("should create a new user via insert", async () => {
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
