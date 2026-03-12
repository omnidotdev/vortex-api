/**
 * Workflow execution integration tests.
 *
 * Tests workflow triggering via REST API and webhooks.
 * Mocks external services (Gatekeeper, Hatchet) so tests run
 * with only a PostgreSQL database.
 */

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

// Mutable state set in beforeAll, referenced by the apiKey mock
let _testApiKey = "";
let _testOrganizationId = "";

// -- Module mocks (must precede dynamic imports of api/webhooks) --

// Mock entitlements to avoid Aether dependency
mock.module("lib/entitlements/enforce", () => ({
  getPlanLimit: async () => -1,
  checkFeatureEnabled: async () => true,
  assertUnderLimit: () => {},
}));

// Mock API key validation to skip Gatekeeper
mock.module("lib/auth/apiKey", () => ({
  default: async (authHeader: string | undefined) => {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const key = authHeader.slice(7);
    if (key === _testApiKey) {
      return { organizationId: _testOrganizationId, name: "Test API Key" };
    }
    return null;
  },
}));

// Mock dispatch to skip Hatchet
const mockDispatch = mock(async () => {});
mock.module("lib/dispatch", () => ({
  dispatchWorkflow: mockDispatch,
}));

// Mock Hatchet REST client
mock.module("lib/hatchet/client", () => ({
  pushEvent: async () => {},
  isConfigured: () => true,
}));

// Mock server module (publishEventBestEffort does dynamic import("server"))
mock.module("server", () => ({
  eventsClient: null,
}));

// Dynamic imports after mocks are established
const { default: api } = await import("api");
const { default: webhooks } = await import("webhooks");

import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { dbPool as db } from "lib/db/db";
import { workflowRunTable } from "lib/db/schema";
import {
  cleanupTestUser,
  createTestApiKey,
  createTestOrganization,
  createTestUser,
  createTestWorkflow,
} from "../utils/testDb";

describe("Workflow Execution", () => {
  let testUserId: string;
  let testWorkflowId: string;
  let testWebhookSecret: string;
  let app: ReturnType<typeof createTestApp>;

  function createTestApp() {
    return new Elysia().use(api).use(webhooks);
  }

  beforeAll(async () => {
    const user = await createTestUser();
    testUserId = user.id;

    const organization = await createTestOrganization(testUserId);
    _testOrganizationId = organization.organizationId;

    const workflow = await createTestWorkflow(_testOrganizationId, testUserId);
    testWorkflowId = workflow.id;
    testWebhookSecret = workflow.webhookSecret!;

    _testApiKey = `test-api-key-${Date.now()}`;
    await createTestApiKey(_testOrganizationId, _testApiKey);

    app = createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUser(testUserId);
  });

  describe("REST API Trigger", () => {
    test("should reject requests without API key", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/api/v1/workflows/${testWorkflowId}/trigger`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
              Authorization: `Bearer ${_testApiKey}`,
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
          headers: { Authorization: `Bearer ${_testApiKey}` },
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
          headers: { Authorization: `Bearer ${_testApiKey}` },
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: "test" }),
          },
        ),
      );

      expect(response.status).toBe(401);
    });

    test("should accept webhook with valid secret", async () => {
      const response = await app.handle(
        new Request(
          `http://localhost/webhooks/workflow/${testWorkflowId}/${testWebhookSecret}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: "test" }),
          },
        ),
      );

      expect([200, 202]).toContain(response.status);
    });

    test("should return 404 for non-existent workflow webhook", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/webhooks/workflow/00000000-0000-0000-0000-000000000000/any-secret",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: "test" }),
          },
        ),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("Workflow Run Status", () => {
    test("should create workflow run record", async () => {
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

      const fetchedRun = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, run.id),
      });

      expect(fetchedRun).toBeDefined();
      expect(fetchedRun?.status).toBe("pending");
    });

    test("should update workflow run status", async () => {
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

      await db
        .update(workflowRunTable)
        .set({ status: "running", startedAt: new Date().toISOString() })
        .where(eq(workflowRunTable.id, run.id));

      const updatedRun = await db.query.workflowRunTable.findFirst({
        where: eq(workflowRunTable.id, run.id),
      });

      expect(updatedRun?.status).toBe("running");
      expect(updatedRun?.startedAt).toBeDefined();

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
            headers: { Authorization: `Bearer ${_testApiKey}` },
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
