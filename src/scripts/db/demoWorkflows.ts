/**
 * Demo workflows in ReactFlow format
 *
 * These workflows are stored in ReactFlow format (nodes/edges) so they:
 * 1. Display correctly in the UI editor
 * 2. Can be executed via API, webhook, or UI (worker auto-converts to DSL)
 */

interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

interface ReactFlowDefinition {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  version: "1.0";
}

interface DemoWorkflow {
  name: string;
  description: string;
  definition: ReactFlowDefinition;
  webhookSecret?: string;
}

/**
 * Demo Workflow 1: API Data Fetcher
 * Manual Trigger → HTTP GET → Transform (extract title)
 *
 * This workflow fetches a post from JSONPlaceholder API and extracts the title.
 * Works via: UI Execute button, API trigger, SDK
 */
const apiDataFetcher: DemoWorkflow = {
  name: "API Data Fetcher",
  description:
    "Fetches a post from JSONPlaceholder API and extracts the title. Click Execute to run.",
  definition: {
    nodes: [
      {
        id: "trigger_1",
        type: "triggerNode",
        position: { x: 250, y: 50 },
        data: {
          label: "Manual Trigger",
          description: "Click Execute to start",
          triggerType: "manual",
          config: {},
        },
      },
      {
        id: "http_1",
        type: "actionNode",
        position: { x: 250, y: 180 },
        data: {
          label: "Fetch Post",
          description: "GET from JSONPlaceholder",
          pluginId: "builtin:http",
          operation: "request",
          config: {
            url: "https://jsonplaceholder.typicode.com/posts/1",
            method: "GET",
          },
        },
      },
      {
        id: "transform_1",
        type: "actionNode",
        position: { x: 250, y: 310 },
        data: {
          label: "Extract Title",
          description: "Get title from response",
          pluginId: "builtin:transform",
          operation: "jsonPath",
          config: {
            data: "{{steps.http_1.body}}",
            path: "$.title",
            first: true,
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger_1", target: "http_1" },
      { id: "e2", source: "http_1", target: "transform_1" },
    ],
    version: "1.0",
  },
};

/**
 * Demo Workflow 2: Webhook Echo
 * Webhook Trigger → Transform (add timestamp) → HTTP POST to httpbin
 *
 * Receives webhook data, adds a timestamp, and echoes it to httpbin.org.
 * Works via: Webhook POST to /webhooks/workflow/{id}/{secret}
 */
const webhookEcho: DemoWorkflow = {
  name: "Webhook Echo",
  description:
    "Receives webhook data, adds a timestamp, and echoes it to httpbin.org. POST to the webhook URL to test.",
  webhookSecret: "demo-webhook-secret-12345",
  definition: {
    nodes: [
      {
        id: "trigger_1",
        type: "triggerNode",
        position: { x: 250, y: 50 },
        data: {
          label: "Webhook Trigger",
          description: "Receives incoming webhook requests",
          triggerType: "webhook",
          config: {
            method: "POST",
          },
        },
      },
      {
        id: "transform_1",
        type: "actionNode",
        position: { x: 250, y: 180 },
        data: {
          label: "Add Timestamp",
          description: "Format response with timestamp",
          pluginId: "builtin:transform",
          operation: "template",
          config: {
            template: JSON.stringify({
              received_at: "{{now}}",
              original_payload: "{{trigger.body}}",
              message: "Echo from Vortex!",
            }),
          },
        },
      },
      {
        id: "http_1",
        type: "actionNode",
        position: { x: 250, y: 310 },
        data: {
          label: "Echo to HTTPBin",
          description: "POST to httpbin.org",
          pluginId: "builtin:http",
          operation: "request",
          config: {
            url: "https://httpbin.org/post",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Vortex-Demo": "webhook-echo",
            },
            body: "{{steps.transform_1.result}}",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger_1", target: "transform_1" },
      { id: "e2", source: "transform_1", target: "http_1" },
    ],
    version: "1.0",
  },
};

/**
 * Demo Workflow 3: Conditional Router
 * Webhook Trigger → Condition (check priority) → Format → HTTP POST
 *
 * Routes incoming webhooks based on priority field.
 * Works via: Webhook POST with {"priority": "high"} or {"priority": "low"}
 */
const conditionalRouter: DemoWorkflow = {
  name: "Conditional Router",
  description:
    'Routes webhooks based on priority field. POST with {"priority": "high"} or {"priority": "low"} to test.',
  webhookSecret: "demo-conditional-secret",
  definition: {
    nodes: [
      {
        id: "trigger_1",
        type: "triggerNode",
        position: { x: 250, y: 50 },
        data: {
          label: "Webhook Trigger",
          description: "Receives alert payloads",
          triggerType: "webhook",
          config: {},
        },
      },
      {
        id: "condition_1",
        type: "conditionNode",
        position: { x: 250, y: 180 },
        data: {
          label: "Check Priority",
          description: "Route based on priority",
          expression: "trigger.body.priority === 'high'",
          config: {
            expression: "trigger.body.priority === 'high'",
          },
        },
      },
      {
        id: "action_high",
        type: "actionNode",
        position: { x: 100, y: 310 },
        data: {
          label: "Format High Priority",
          description: "Create urgent message",
          pluginId: "builtin:transform",
          operation: "template",
          config: {
            template: JSON.stringify({
              urgency: "HIGH",
              message: "⚠️ High priority alert received!",
              payload: "{{trigger.body}}",
            }),
          },
        },
      },
      {
        id: "action_low",
        type: "actionNode",
        position: { x: 400, y: 310 },
        data: {
          label: "Format Low Priority",
          description: "Create standard message",
          pluginId: "builtin:transform",
          operation: "template",
          config: {
            template: JSON.stringify({
              urgency: "NORMAL",
              message: "Standard priority alert",
              payload: "{{trigger.body}}",
            }),
          },
        },
      },
      {
        id: "http_1",
        type: "actionNode",
        position: { x: 250, y: 440 },
        data: {
          label: "Send to HTTPBin",
          description: "POST formatted result",
          pluginId: "builtin:http",
          operation: "request",
          config: {
            url: "https://httpbin.org/post",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{{steps.action_high.result || steps.action_low.result}}",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger_1", target: "condition_1" },
      {
        id: "e2",
        source: "condition_1",
        target: "action_high",
        sourceHandle: "true",
        label: "High",
      },
      {
        id: "e3",
        source: "condition_1",
        target: "action_low",
        sourceHandle: "false",
        label: "Normal",
      },
      { id: "e4", source: "action_high", target: "http_1" },
      { id: "e5", source: "action_low", target: "http_1" },
    ],
    version: "1.0",
  },
};

/**
 * Demo Workflow 4: Multi-Step Pipeline
 * Manual Trigger → Fetch Users → Extract Names → Fetch Posts → Combine Results
 *
 * Demonstrates chaining multiple HTTP requests and data transformations.
 * Works via: UI Execute button, API trigger
 */
const multiStepPipeline: DemoWorkflow = {
  name: "Multi-Step Pipeline",
  description:
    "Fetches users and posts from JSONPlaceholder, then combines the results. Demonstrates chaining multiple steps.",
  definition: {
    nodes: [
      {
        id: "trigger_1",
        type: "triggerNode",
        position: { x: 250, y: 50 },
        data: {
          label: "Manual Trigger",
          description: "Start the pipeline",
          triggerType: "manual",
          config: {},
        },
      },
      {
        id: "http_users",
        type: "actionNode",
        position: { x: 250, y: 180 },
        data: {
          label: "Fetch Users",
          description: "GET users from API",
          pluginId: "builtin:http",
          operation: "request",
          config: {
            url: "https://jsonplaceholder.typicode.com/users?_limit=3",
            method: "GET",
          },
        },
      },
      {
        id: "transform_names",
        type: "actionNode",
        position: { x: 250, y: 310 },
        data: {
          label: "Extract Names",
          description: "Get user names",
          pluginId: "builtin:transform",
          operation: "jsonPath",
          config: {
            data: "{{steps.http_users.body}}",
            path: "$[*].name",
          },
        },
      },
      {
        id: "http_posts",
        type: "actionNode",
        position: { x: 250, y: 440 },
        data: {
          label: "Fetch Posts",
          description: "GET posts from API",
          pluginId: "builtin:http",
          operation: "request",
          config: {
            url: "https://jsonplaceholder.typicode.com/posts?_limit=3",
            method: "GET",
          },
        },
      },
      {
        id: "transform_combine",
        type: "actionNode",
        position: { x: 250, y: 570 },
        data: {
          label: "Combine Results",
          description: "Merge users and posts",
          pluginId: "builtin:transform",
          operation: "template",
          config: {
            template: JSON.stringify({
              userNames: "{{steps.transform_names.result}}",
              postCount: "{{steps.http_posts.body.length}}",
              summary: "Fetched users and posts successfully",
            }),
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger_1", target: "http_users" },
      { id: "e2", source: "http_users", target: "transform_names" },
      { id: "e3", source: "transform_names", target: "http_posts" },
      { id: "e4", source: "http_posts", target: "transform_combine" },
    ],
    version: "1.0",
  },
};

/**
 * All demo workflows to be seeded
 */
export const demoWorkflows: DemoWorkflow[] = [
  apiDataFetcher,
  webhookEcho,
  conditionalRouter,
  multiStepPipeline,
];
