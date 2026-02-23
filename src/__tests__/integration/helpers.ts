/**
 * Integration test helpers.
 *
 * Factory functions for creating test fixtures used across integration suites.
 */

import { randomUUID } from "node:crypto";

/**
 * Create a test organization fixture.
 */
export const createTestOrg = () => ({
	id: randomUUID(),
	name: `test-org-${randomUUID().slice(0, 8)}`,
});

/**
 * Create a test workflow fixture.
 * @param orgId - Organization ID to associate the workflow with.
 * @param overrides - Optional field overrides.
 */
export const createTestWorkflow = (
	orgId: string,
	overrides?: Record<string, unknown>,
) => ({
	organizationId: orgId,
	name: `test-workflow-${randomUUID().slice(0, 8)}`,
	description: "Integration test workflow",
	definition: {
		nodes: [
			{
				id: "trigger-1",
				type: "trigger",
				data: { triggerType: "manual" },
			},
			{
				id: "action-1",
				type: "action",
				data: { actionType: "http_request", url: "https://example.com" },
			},
		],
		edges: [{ source: "trigger-1", target: "action-1" }],
	},
	isActive: true,
	executor: "hatchet",
	...overrides,
});

/**
 * Create a test API key fixture.
 * @param orgId - Organization ID to associate the key with.
 */
export const createTestApiKey = (orgId: string) => ({
	key: `vortex_test_${randomUUID().replace(/-/g, "")}`,
	organizationId: orgId,
});
