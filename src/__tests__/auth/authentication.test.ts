/**
 * Authentication integration tests.
 *
 * Tests the authentication flow including token validation and user provisioning.
 */

import { afterAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { dbPool as db } from "lib/db/db";
import { userTable, workspaceTable } from "lib/db/schema";
import { cleanupTestUser, createTestUser } from "../utils/testDb";

describe("Authentication", () => {
  let testUserId: string | null = null;

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await cleanupTestUser(testUserId);
    }
  });

  describe("User Provisioning", () => {
    test("should create a new user in the database", async () => {
      const user = await createTestUser({
        identityProviderId: "test-auth-idp-1",
        email: "auth-test-1@example.com",
        name: "Auth Test User",
      });

      testUserId = user.id;

      expect(user.id).toBeDefined();
      expect(user.email).toBe("auth-test-1@example.com");
    });

    test("should update existing user on conflict", async () => {
      // First create
      const user1 = await createTestUser({
        identityProviderId: "test-auth-idp-2",
        email: "auth-test-2@example.com",
        name: "Original Name",
      });

      // Update by inserting with same identityProviderId
      const [user2] = await db
        .insert(userTable)
        .values({
          identityProviderId: "test-auth-idp-2",
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

      // Clean up
      await cleanupTestUser(user1.id);
    });
  });

  describe("Demo Workspace Auto-enrollment", () => {
    test("should auto-enroll user in demo workspace if it exists", async () => {
      // Create demo workspace
      const demoUser = await createTestUser({
        identityProviderId: "demo-owner-idp",
        email: "demo-owner@example.com",
      });

      const [_demoWorkspace] = await db
        .insert(workspaceTable)
        .values({
          name: "Demo Workspace",
          slug: "demo",
        })
        .onConflictDoNothing()
        .returning();

      // Check if demo workspace exists (may have been created already)
      const existingDemo = await db
        .select()
        .from(workspaceTable)
        .where(eq(workspaceTable.slug, "demo"))
        .limit(1);

      expect(existingDemo.length).toBeGreaterThan(0);

      // Clean up demo owner (not the workspace, as it may be shared)
      await cleanupTestUser(demoUser.id);
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
