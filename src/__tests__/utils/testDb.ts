/**
 * Test database utilities.
 *
 * Provides helpers for setting up test data and cleaning up after tests.
 */

import { eq } from "drizzle-orm";

import { dbPool as db } from "lib/db/db";
import {
  integrationTable,
  userOrganizationTable,
  userTable,
  workflowRunTable,
  workflowStepLogTable,
  workflowTable,
} from "lib/db/schema";

import type { InsertUser, InsertWorkflow } from "lib/db/schema";

/**
 * Create a test user.
 */
export async function createTestUser(
  overrides: Partial<InsertUser> = {},
): Promise<{ id: string; email: string; identityProviderId: string }> {
  const timestamp = Date.now();
  const [user] = await db
    .insert(userTable)
    .values({
      identityProviderId: `test-idp-${timestamp}`,
      email: `test-${timestamp}@example.com`,
      name: "Test User",
      ...overrides,
    })
    .returning();

  return user;
}

/**
 * Create a test organization membership for a user.
 */
export async function createTestOrganization(
  userId: string,
  overrides: {
    organizationId?: string;
    role?: "owner" | "admin" | "member";
  } = {},
): Promise<{ id: string; organizationId: string }> {
  const timestamp = Date.now();
  const organizationId = overrides.organizationId || `test-org-${timestamp}`;

  const [membership] = await db
    .insert(userOrganizationTable)
    .values({
      userId,
      organizationId,
      slug: `test-org-${timestamp}`,
      name: `Test Organization ${timestamp}`,
      role: overrides.role || "owner",
    })
    .returning();

  return membership;
}

/**
 * Create a test workflow.
 */
export async function createTestWorkflow(
  organizationId: string,
  createdBy: string,
  overrides: Partial<InsertWorkflow> = {},
): Promise<{ id: string; name: string; webhookSecret: string | null }> {
  const timestamp = Date.now();
  const [workflow] = await db
    .insert(workflowTable)
    .values({
      organizationId,
      name: `Test Workflow ${timestamp}`,
      description: "A test workflow",
      definition: {
        version: "1.0",
        steps: [],
        edges: [],
      },
      isActive: true,
      webhookSecret: `secret-${timestamp}`,
      createdBy,
      ...overrides,
    })
    .returning();

  return workflow;
}

/**
 * Create an API key integration for testing.
 */
export async function createTestApiKey(
  organizationId: string,
  apiKey: string,
): Promise<{ id: string }> {
  const [integration] = await db
    .insert(integrationTable)
    .values({
      organizationId,
      type: "api_key",
      name: "Test API Key",
      config: { apiKey },
      isEnabled: true,
    })
    .returning();

  return integration;
}

/**
 * Clean up test data by user ID.
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  // Get user's organizations
  const userOrgs = await db
    .select()
    .from(userOrganizationTable)
    .where(eq(userOrganizationTable.userId, userId));

  for (const org of userOrgs) {
    // Clean up workflow runs and step logs
    const workflows = await db
      .select()
      .from(workflowTable)
      .where(eq(workflowTable.organizationId, org.organizationId));

    for (const workflow of workflows) {
      const runs = await db
        .select()
        .from(workflowRunTable)
        .where(eq(workflowRunTable.workflowId, workflow.id));

      for (const run of runs) {
        await db
          .delete(workflowStepLogTable)
          .where(eq(workflowStepLogTable.workflowRunId, run.id));
      }

      await db
        .delete(workflowRunTable)
        .where(eq(workflowRunTable.workflowId, workflow.id));
    }

    // Clean up workflows
    await db
      .delete(workflowTable)
      .where(eq(workflowTable.organizationId, org.organizationId));

    // Clean up integrations
    await db
      .delete(integrationTable)
      .where(eq(integrationTable.organizationId, org.organizationId));

    // Clean up organization membership
    await db
      .delete(userOrganizationTable)
      .where(eq(userOrganizationTable.id, org.id));
  }

  // Clean up user
  await db.delete(userTable).where(eq(userTable.id, userId));
}
