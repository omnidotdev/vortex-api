/**
 * Test database utilities.
 *
 * Provides helpers for setting up test data and cleaning up after tests.
 */

import { eq } from "drizzle-orm";

import { dbPool as db } from "lib/db/db";
import {
  integrationTable,
  userTable,
  workflowRunTable,
  workflowStepLogTable,
  workflowTable,
  workspaceTable,
  workspaceUserTable,
} from "lib/db/schema";

import type {
  InsertUser,
  InsertWorkflow,
  InsertWorkspace,
} from "lib/db/schema";

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
 * Create a test workspace.
 */
export async function createTestWorkspace(
  ownerId: string,
  overrides: Partial<InsertWorkspace> = {},
): Promise<{ id: string; slug: string }> {
  const timestamp = Date.now();
  const [workspace] = await db
    .insert(workspaceTable)
    .values({
      name: `Test Workspace ${timestamp}`,
      slug: `test-workspace-${timestamp}`,
      organizationId: overrides.organizationId || `test-org-${timestamp}`,
      ...overrides,
    })
    .returning();

  // Add owner to workspace
  await db.insert(workspaceUserTable).values({
    workspaceId: workspace.id,
    userId: ownerId,
    role: "owner",
  });

  return workspace;
}

/**
 * Create a test workflow.
 */
export async function createTestWorkflow(
  workspaceId: string,
  createdBy: string,
  overrides: Partial<InsertWorkflow> = {},
): Promise<{ id: string; name: string; webhookSecret: string | null }> {
  const timestamp = Date.now();
  const [workflow] = await db
    .insert(workflowTable)
    .values({
      workspaceId,
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
  workspaceId: string,
  apiKey: string,
): Promise<{ id: string }> {
  const [integration] = await db
    .insert(integrationTable)
    .values({
      workspaceId,
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
  // Get user's workspaces
  const workspaceUsers = await db
    .select()
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, userId));

  for (const wu of workspaceUsers) {
    // Clean up workflow runs and step logs
    const workflows = await db
      .select()
      .from(workflowTable)
      .where(eq(workflowTable.workspaceId, wu.workspaceId));

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
      .where(eq(workflowTable.workspaceId, wu.workspaceId));

    // Clean up integrations
    await db
      .delete(integrationTable)
      .where(eq(integrationTable.workspaceId, wu.workspaceId));

    // Clean up workspace users
    await db
      .delete(workspaceUserTable)
      .where(eq(workspaceUserTable.workspaceId, wu.workspaceId));

    // Clean up workspace
    await db
      .delete(workspaceTable)
      .where(eq(workspaceTable.id, wu.workspaceId));
  }

  // Clean up user
  await db.delete(userTable).where(eq(userTable.id, userId));
}
