/**
 * Workflow execution integration tests.
 *
 * Tests workflow triggering via REST API and webhooks.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// Import the API routes for testing
import api from "api";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import webhooks from "webhooks";

import { dbPool as db } from "lib/db/db";
import { workflowRunTable } from "lib/db/schema";
import {
  cleanupTestUser,
  createTestApiKey,
  createTestUser,
  createTestWorkflow,
  createTestWorkspace,
} from "../utils/testDb";

describe("Workflow Execution", () => {
  let testUserId: string;
  let testWorkspaceId: string;
  let testWorkflowId: string;
  let _testWebhookSecret: string;
  let testApiKey: string;
  let app: Elysia;

  beforeAll(async () => {
    // Create test data
    const user = await createTestUser();
    testUserId = user.id;

    const workspace = await createTestWorkspace(testUserId);
    testWorkspaceId = workspace.id;

    const workflow = await createTestWorkflow(testWorkspaceId, testUserId);
    testWorkflowId = workflow.id;
    _testWebhookSecret = workflow.webhookSecret!;

    // Create API key for REST API tests
    testApiKey = `test-api-key-${Date.now()}`;
    await createTestApiKey(testWorkspaceId, testApiKey);

    // Create test Elysia app with API and webhooks
    app = new Elysia().use(api).use(webhooks);
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestUser(testUserId);
  });

  describe("REST API Trigger", () => {
    test("should reject requests without API key", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/workflows/${testWorkflowId}/trigger`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ data: { test: true } }),
          },
        ),
      );

      expect(response.status).toBe(401);
    });

    test("should reject requests with invalid API key", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/workflows/${testWorkflowId}/trigger`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer invalid-api-key",
            },
            body: JSON.stringify({ data: { test: true } }),
          },
        ),
      );

      expect(response.status).toBe(401);
    });

    test("should return 404 for non-existent workflow", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/api/v1/workflows/00000000-0000-0000-0000-000000000000/trigger",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${testApiKey}`,
            },
            body: JSON.stringify({ data: { test: true } }),
          },
        ),
      );

      expect(response.status).toBe(404);
    });

    test("should list workflows", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/v1/workflows", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workflows).toBeDefined();
      expect(Array.isArray(data.workflows)).toBe(true);
    });

    test("should get workflow details", async () => {
      const response = await app.handle(
        new Request(`http://localhost/api/v1/workflows/${testWorkflowId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(testWorkflowId);
      expect(data.name).toBeDefined();
    });
  });

  describe("Webhook Trigger", () => {
    test("should reject webhook with invalid secret", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/webhooks/workflow/${testWorkflowId}/wrong-secret`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payload: "test" }),
          },
        ),
      );

      expect(response.status).toBe(401);
    });

    test("should return 404 for non-existent workflow webhook", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/webhooks/workflow/00000000-0000-0000-0000-000000000000/any-secret",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ payload: "test" }),
          },
        ),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("Workflow Run Status", () => {
    test("should create workflow run record", async () => {
      // Create a run directly for testing
      const [run] = await db
        .insert(workflowRunTable)
        .values({
          workflowId: testWorkflowId,
          engineWorkflowId: `test-engine-${Date.now()}`,
          engineRunId: `test-run-${Date.now()}`,
          status: "pending",
          input: { test: true },
        })
        .returning();

      expect(run.id).toBeDefined();
      expect(run.status).toBe("pending");
      expect(run.workflowId).toBe(testWorkflowId);

      // Verify run can be fetched
      const fetchedRun = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, run.id),
      });

      expect(fetchedRun).toBeDefined();
      expect(fetchedRun?.status).toBe("pending");
    });

    test("should update workflow run status", async () => {
      // Create a run
      const [run] = await db
        .insert(workflowRunTable)
        .values({
          workflowId: testWorkflowId,
          engineWorkflowId: `test-engine-${Date.now()}`,
          engineRunId: `test-run-${Date.now()}`,
          status: "pending",
          input: {},
        })
        .returning();

      // Update status to running
      await db
        .update(workflowRunTable)
        .set({ status: "running", startedAt: new Date().toISOString() })
        .where(eq(workflowRunTable.id, run.id));

      // Verify update
      const updatedRun = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, run.id),
      });

      expect(updatedRun?.status).toBe("running");
      expect(updatedRun?.startedAt).toBeDefined();

      // Update to completed
      await db
        .update(workflowRunTable)
        .set({
          status: "completed",
          completedAt: new Date().toISOString(),
          output: { result: "success" },
        })
        .where(eq(workflowRunTable.id, run.id));

      const completedRun = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, run.id),
      });

      expect(completedRun?.status).toBe("completed");
      expect(completedRun?.completedAt).toBeDefined();
      expect(completedRun?.output).toEqual({ result: "success" });
    });

    test("should list workflow runs via API", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/workflows/${testWorkflowId}/runs`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${testApiKey}`,
            },
          },
        ),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.runs).toBeDefined();
      expect(Array.isArray(data.runs)).toBe(true);
    });
  });
});
