import type { WorkflowDefinition } from "lib/workflow/types";

interface DemoWorkflow {
  name: string;
  description: string;
  definition: WorkflowDefinition;
  webhookSecret?: string;
}

/**
 * Demo Workflow 1: Hello World API
 * Manual Trigger → HTTP GET → Transform (extract title)
 */
const helloWorldApi: DemoWorkflow = {
  name: "Hello World API",
  description:
    "Fetches a post from JSONPlaceholder API and extracts the title. A simple demo of HTTP requests and data transformation.",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger",
        type: "trigger",
        name: "Manual Trigger",
        description: "Click to run this workflow",
        position: { x: 250, y: 50 },
        trigger: {
          type: "manual",
          config: {},
        },
      },
      {
        id: "fetch-post",
        type: "action",
        name: "Fetch Post",
        description: "Get a post from JSONPlaceholder",
        position: { x: 250, y: 180 },
        action: {
          pluginId: "builtin:http",
          operation: "get",
          inputs: {
            url: "https://jsonplaceholder.typicode.com/posts/1",
          },
          outputs: {
            postData: "body",
          },
        },
      },
      {
        id: "extract-title",
        type: "action",
        name: "Extract Title",
        description: "Extract the title from the response",
        position: { x: 250, y: 310 },
        action: {
          pluginId: "builtin:transform",
          operation: "jsonPath",
          inputs: {
            data: "{{steps.fetch-post.body}}",
            path: "$.title",
            first: true,
          },
          outputs: {
            title: "result",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "fetch-post" },
      { id: "e2", source: "fetch-post", target: "extract-title" },
    ],
  },
};

/**
 * Demo Workflow 2: Webhook Echo
 * Webhook Trigger → Transform (format) → HTTP POST to httpbin
 */
const webhookEcho: DemoWorkflow = {
  name: "Webhook Echo",
  description:
    "Receives webhook data, formats it with a timestamp, and echoes it to httpbin.org. Great for testing webhook integrations.",
  webhookSecret: "demo-webhook-secret-12345",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger",
        type: "trigger",
        name: "Webhook Trigger",
        description: "Receives incoming webhook requests",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {
            method: "POST",
          },
        },
      },
      {
        id: "format-data",
        type: "action",
        name: "Format Response",
        description: "Add timestamp to the payload",
        position: { x: 250, y: 180 },
        action: {
          pluginId: "builtin:transform",
          operation: "template",
          inputs: {
            template:
              '{"received_at": "{{timestamp}}", "original_payload": {{payload}}}',
            variables: {
              timestamp: "{{trigger.receivedAt}}",
              payload: "{{trigger.body}}",
            },
          },
        },
      },
      {
        id: "echo-to-httpbin",
        type: "action",
        name: "Echo to HTTPBin",
        description: "Send formatted data to httpbin.org",
        position: { x: 250, y: 310 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "https://httpbin.org/post",
            headers: {
              "Content-Type": "application/json",
              "X-Vortex-Demo": "webhook-echo",
            },
            body: "{{steps.format-data.result}}",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "format-data" },
      { id: "e2", source: "format-data", target: "echo-to-httpbin" },
    ],
  },
};

/**
 * Demo Workflow 3: Discord Notification
 * Manual Trigger (with message) → Transform (Discord embed) → HTTP POST to Discord
 */
const discordNotification: DemoWorkflow = {
  name: "Discord Notification",
  description:
    "Send a rich embed message to a Discord channel via webhook. Configure your Discord webhook URL in the HTTP action.",
  definition: {
    version: "1.0",
    variables: {
      discordWebhookUrl: {
        type: "string",
        description: "Your Discord webhook URL",
        default: "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN",
      },
    },
    steps: [
      {
        id: "trigger",
        type: "trigger",
        name: "Manual Trigger",
        description: "Provide a message to send",
        position: { x: 250, y: 50 },
        trigger: {
          type: "manual",
          config: {
            inputSchema: {
              type: "object",
              properties: {
                title: { type: "string", default: "Vortex Notification" },
                message: { type: "string" },
                color: { type: "number", default: 5814783 },
              },
              required: ["message"],
            },
          },
        },
      },
      {
        id: "format-embed",
        type: "action",
        name: "Format Discord Embed",
        description: "Create Discord embed structure",
        position: { x: 250, y: 180 },
        action: {
          pluginId: "builtin:transform",
          operation: "map",
          inputs: {
            data: "{{trigger}}",
            mapping: {
              embeds: [
                {
                  title: "{{trigger.title}}",
                  description: "{{trigger.message}}",
                  color: "{{trigger.color}}",
                  footer: {
                    text: "Sent via Vortex",
                  },
                  timestamp: "{{trigger.receivedAt}}",
                },
              ],
            },
          },
        },
      },
      {
        id: "send-to-discord",
        type: "action",
        name: "Send to Discord",
        description: "POST to Discord webhook",
        position: { x: 250, y: 310 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.discordWebhookUrl}}",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{{steps.format-embed.result}}",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "format-embed" },
      { id: "e2", source: "format-embed", target: "send-to-discord" },
    ],
  },
};

/**
 * Demo Workflow 4: Slack Alert
 * Webhook Trigger → Condition (check severity) → HTTP POST to Slack
 */
const slackAlert: DemoWorkflow = {
  name: "Slack Alert",
  description:
    "Receives alerts via webhook and routes them to Slack based on severity. Critical alerts get special formatting.",
  webhookSecret: "demo-slack-alert-secret",
  definition: {
    version: "1.0",
    variables: {
      slackWebhookUrl: {
        type: "string",
        description: "Your Slack incoming webhook URL",
        default: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
      },
    },
    steps: [
      {
        id: "trigger",
        type: "trigger",
        name: "Alert Webhook",
        description: "Receives alert payloads with severity field",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {
            method: "POST",
          },
        },
      },
      {
        id: "check-severity",
        type: "condition",
        name: "Check Severity",
        description: "Route based on alert severity",
        position: { x: 250, y: 180 },
        condition: {
          expression: "{{trigger.body.severity}} === 'critical'",
          trueBranch: "format-critical",
          falseBranch: "format-normal",
        },
      },
      {
        id: "format-critical",
        type: "action",
        name: "Format Critical Alert",
        description: "Create urgent Slack message",
        position: { x: 100, y: 310 },
        action: {
          pluginId: "builtin:transform",
          operation: "map",
          inputs: {
            data: "{{trigger.body}}",
            mapping: {
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: "🚨 CRITICAL ALERT",
                    emoji: true,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "*{{trigger.body.title}}*\n{{trigger.body.message}}",
                  },
                },
                {
                  type: "context",
                  elements: [
                    {
                      type: "mrkdwn",
                      text: "Severity: *CRITICAL* | Source: {{trigger.body.source}}",
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        id: "format-normal",
        type: "action",
        name: "Format Normal Alert",
        description: "Create standard Slack message",
        position: { x: 400, y: 310 },
        action: {
          pluginId: "builtin:transform",
          operation: "map",
          inputs: {
            data: "{{trigger.body}}",
            mapping: {
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "*{{trigger.body.title}}*\n{{trigger.body.message}}",
                  },
                },
                {
                  type: "context",
                  elements: [
                    {
                      type: "mrkdwn",
                      text: "Severity: {{trigger.body.severity}} | Source: {{trigger.body.source}}",
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        id: "send-to-slack",
        type: "action",
        name: "Send to Slack",
        description: "POST to Slack webhook",
        position: { x: 250, y: 440 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.slackWebhookUrl}}",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{{steps.format-critical.result || steps.format-normal.result}}",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "check-severity" },
      {
        id: "e2",
        source: "check-severity",
        target: "format-critical",
        sourceHandle: "true",
        label: "Critical",
      },
      {
        id: "e3",
        source: "check-severity",
        target: "format-normal",
        sourceHandle: "false",
        label: "Normal",
      },
      { id: "e4", source: "format-critical", target: "send-to-slack" },
      { id: "e5", source: "format-normal", target: "send-to-slack" },
    ],
  },
};

/**
 * Demo Workflow 5: Data Pipeline with Loop
 * Manual Trigger (array) → Loop → HTTP GET per item → Transform aggregate
 */
const dataPipeline: DemoWorkflow = {
  name: "Data Pipeline with Loop",
  description:
    "Processes an array of post IDs, fetches each from the API, and aggregates the titles. Demonstrates loop functionality.",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger",
        type: "trigger",
        name: "Manual Trigger",
        description: "Provide array of post IDs to fetch",
        position: { x: 250, y: 50 },
        trigger: {
          type: "manual",
          config: {
            inputSchema: {
              type: "object",
              properties: {
                postIds: {
                  type: "array",
                  items: { type: "number" },
                  default: [1, 2, 3, 4, 5],
                },
              },
            },
          },
        },
      },
      {
        id: "fetch-loop",
        type: "loop",
        name: "Fetch Each Post",
        description: "Loop through post IDs and fetch each",
        position: { x: 250, y: 180 },
        loop: {
          type: "forEach",
          collection: "{{trigger.postIds}}",
          itemVariable: "postId",
          indexVariable: "index",
          body: ["fetch-single-post"],
          maxIterations: 10,
        },
      },
      {
        id: "fetch-single-post",
        type: "action",
        name: "Fetch Single Post",
        description: "GET request for one post",
        position: { x: 250, y: 310 },
        action: {
          pluginId: "builtin:http",
          operation: "get",
          inputs: {
            url: "https://jsonplaceholder.typicode.com/posts/{{loop.postId}}",
          },
        },
      },
      {
        id: "aggregate-results",
        type: "action",
        name: "Aggregate Results",
        description: "Extract titles from all fetched posts",
        position: { x: 250, y: 440 },
        action: {
          pluginId: "builtin:transform",
          operation: "jsonPath",
          inputs: {
            data: "{{steps.fetch-loop.results}}",
            path: "$[*].body.title",
          },
          outputs: {
            titles: "result",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "fetch-loop" },
      { id: "e2", source: "fetch-loop", target: "aggregate-results" },
    ],
  },
};

/**
 * All demo workflows to be seeded
 */
export const demoWorkflows: DemoWorkflow[] = [
  helloWorldApi,
  webhookEcho,
  discordNotification,
  slackAlert,
  dataPipeline,
];
