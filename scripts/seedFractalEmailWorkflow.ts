#!/usr/bin/env bun
/**
 * Seed Fractal Email Send Workflow
 *
 * Registers the fractal-email-send workflow and an event routing rule
 * that triggers it on `fractal.*` events.
 *
 * Usage:
 *   VORTEX_API_URL=https://api.vortex.omni.dev \
 *   VORTEX_API_KEY=<key> \
 *   VORTEX_ORGANIZATION_ID=<org-id> \
 *   bun run scripts/seedFractalEmailWorkflow.ts
 */

import template from "../../vortex-worker/src/workflows/templates/fractal-email-send.json";

const {
	VORTEX_API_URL = "http://localhost:4100",
	VORTEX_API_KEY,
	VORTEX_ORGANIZATION_ID,
} = process.env;

if (!VORTEX_API_KEY) {
	console.error("VORTEX_API_KEY is required");
	process.exit(1);
}

if (!VORTEX_ORGANIZATION_ID) {
	console.error("VORTEX_ORGANIZATION_ID is required");
	process.exit(1);
}

const WORKFLOW_NAME = "fractal-email-send";

// Step 1: Upsert the workflow via REST API
const workflowRes = await fetch(
	`${VORTEX_API_URL}/api/v1/workflows/${WORKFLOW_NAME}`,
	{
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: VORTEX_API_KEY,
		},
		body: JSON.stringify({
			definition: template,
			description:
				"Send email notifications for Fractal service lifecycle events (build failed, deploy succeeded, service crashed)",
			isActive: true,
		}),
	},
);

if (!workflowRes.ok) {
	const body = await workflowRes.text();
	console.error(
		`Failed to upsert workflow: ${workflowRes.status} ${body}`,
	);
	process.exit(1);
}

const workflow = (await workflowRes.json()) as { id: string; name: string };
console.log(`Upserted workflow: ${workflow.name} (id: ${workflow.id})`);

// Step 2: Create event routing rule via GraphQL
const routingRuleRes = await fetch(`${VORTEX_API_URL}/graphql`, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		Authorization: VORTEX_API_KEY,
	},
	body: JSON.stringify({
		query: `mutation CreateEventRoutingRule($input: CreateEventRoutingRuleInput!) {
      createEventRoutingRule(input: $input) {
        eventRoutingRule {
          rowId
          typePattern
          sourcePattern
          enabled
          priority
        }
      }
    }`,
		variables: {
			input: {
				eventRoutingRule: {
					organizationId: VORTEX_ORGANIZATION_ID,
					workflowId: workflow.id,
					typePattern: "fractal.*",
					sourcePattern: "omni.fractal",
					enabled: true,
					priority: 0,
				},
			},
		},
	}),
});

if (!routingRuleRes.ok) {
	const body = await routingRuleRes.text();
	console.error(
		`Failed to create routing rule: ${routingRuleRes.status} ${body}`,
	);
	process.exit(1);
}

const routingResult = (await routingRuleRes.json()) as {
	data?: {
		createEventRoutingRule?: {
			eventRoutingRule?: {
				rowId: string;
				typePattern: string;
				sourcePattern: string;
			};
		};
	};
	errors?: Array<{ message: string }>;
};

if (routingResult.errors?.length) {
	// Check if it's a uniqueness conflict (rule already exists)
	const isDuplicate = routingResult.errors.some(
		(e) =>
			e.message.includes("duplicate") ||
			e.message.includes("unique") ||
			e.message.includes("already exists"),
	);

	if (isDuplicate) {
		console.log(
			"Event routing rule already exists for fractal.*",
		);
	} else {
		console.error(
			"GraphQL errors:",
			JSON.stringify(routingResult.errors, null, 2),
		);
		process.exit(1);
	}
} else {
	const rule =
		routingResult.data?.createEventRoutingRule?.eventRoutingRule;
	console.log(
		`Created event routing rule: ${rule?.typePattern} -> workflow ${workflow.id} (id: ${rule?.rowId})`,
	);
}

console.log("Done seeding fractal-email-send workflow");
