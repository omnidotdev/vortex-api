import type { InsertWorkflowTemplate } from "../schema/workflowTemplate.table";

/**
 * Send Discord Message workflow template.
 * A simple workflow that sends a message to a Discord channel via webhook.
 */
const discordSendMessageTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "discord-send-message",
  name: "Send Discord Message",
  description:
    "Send a message to a Discord channel using the Discord bot integration.",
  longDescription: `
## Send Discord Message

This template creates a workflow that sends messages to a Discord channel using the Discord integration.

### Use Cases
- Send notifications when events occur
- Post automated updates to team channels
- Create alerts for monitoring systems

### Setup Required
1. Connect your Discord bot via the Integrations page
2. Ensure your bot has access to the target channel

### Customization
- Modify the trigger to use webhooks, cron, or events
- Add conditions to filter when messages are sent
- Include dynamic data from trigger payload
`.trim(),
  category: "communication",
  tags: ["discord", "messaging", "notifications", "bot"],
  iconUrl: "https://cdn.simpleicons.org/discord",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_1",
        type: "trigger",
        name: "Manual Trigger",
        description: "Start the workflow manually or via API",
        position: { x: 250, y: 50 },
        trigger: {
          type: "manual",
          config: {},
        },
      },
      {
        id: "action_send_discord",
        type: "action",
        name: "Send Discord Message",
        description: "Send a message to a Discord channel",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "discord",
          operation: "send_message",
          inputs: {
            channelId: "{{variables.channelId}}",
            content: "{{trigger.message}}",
          },
          outputs: {
            messageId: "discordMessageId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_1",
        target: "action_send_discord",
      },
    ],
    variables: {
      channelId: {
        type: "string",
        description: "Discord channel ID to send the message to",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["discord"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "100",
};

/**
 * Discord Rich Embed workflow template.
 * Sends a richly formatted embed message to Discord.
 */
const discordRichEmbedTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "discord-rich-embed",
  name: "Discord Rich Embed",
  description:
    "Send a richly formatted embed message to Discord with title, description, fields, and colors.",
  longDescription: `
## Discord Rich Embed

Send beautifully formatted messages to Discord using embeds.

### Features
- Custom title, description, and color
- Multiple fields in a grid layout
- Thumbnail and footer images
- Author information
- Timestamps

### Use Cases
- Build status notifications
- Alert dashboards
- Daily reports
- Event announcements

### Setup Required
1. Connect your Discord bot via the Integrations page
2. Ensure your bot has access to the target channel
`.trim(),
  category: "communication",
  tags: ["discord", "messaging", "embed", "notifications", "rich-text"],
  iconUrl: "https://cdn.simpleicons.org/discord",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_1",
        type: "trigger",
        name: "Manual Trigger",
        description: "Start the workflow manually",
        position: { x: 250, y: 50 },
        trigger: {
          type: "manual",
          config: {},
        },
      },
      {
        id: "action_send_embed",
        type: "action",
        name: "Send Discord Embed",
        description: "Send a rich embed to Discord",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "discord",
          operation: "send_message",
          inputs: {
            channelId: "{{variables.channelId}}",
            content: "",
            embeds: [
              {
                title: "{{trigger.title}}",
                description: "{{trigger.description}}",
                color: 5814783, // Discord blue
                fields: [
                  {
                    name: "Status",
                    value: "{{trigger.status}}",
                    inline: true,
                  },
                  {
                    name: "Timestamp",
                    value: "{{trigger.timestamp}}",
                    inline: true,
                  },
                ],
                footer: {
                  text: "Powered by Vortex",
                },
              },
            ],
          },
          outputs: {
            messageId: "discordMessageId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_1",
        target: "action_send_embed",
      },
    ],
    variables: {
      channelId: {
        type: "string",
        description: "Discord channel ID to send the embed to",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["discord"],
  isPublic: true,
  isFeatured: false,
  sortOrder: "110",
};

/**
 * Discord Notification on Schedule template.
 * Sends a scheduled message to Discord (e.g., daily standup reminder).
 */
const discordScheduledNotificationTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "discord-scheduled-notification",
  name: "Discord Scheduled Notification",
  description:
    "Send scheduled messages to Discord (e.g., daily standup reminders, weekly reports).",
  longDescription: `
## Discord Scheduled Notification

Automate recurring messages to your Discord channels.

### Examples
- Daily standup reminders at 9 AM
- Weekly team updates every Friday
- Monthly metrics reports

### Setup Required
1. Connect your Discord bot via the Integrations page
2. Ensure your bot has access to the target channel

### Customization
- Adjust the cron expression for your schedule
- Modify the message content
- Add dynamic data from external sources
`.trim(),
  category: "communication",
  tags: ["discord", "messaging", "scheduled", "cron", "reminder", "automation"],
  iconUrl: "https://cdn.simpleicons.org/discord",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_cron",
        type: "trigger",
        name: "Daily at 9 AM",
        description: "Runs every day at 9:00 AM UTC",
        position: { x: 250, y: 50 },
        trigger: {
          type: "cron",
          config: {
            expression: "0 9 * * *",
            timezone: "UTC",
          },
        },
      },
      {
        id: "action_send_reminder",
        type: "action",
        name: "Send Reminder",
        description: "Send the scheduled reminder to Discord",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "discord",
          operation: "send_message",
          inputs: {
            channelId: "{{variables.channelId}}",
            content: "{{variables.message}}",
          },
          outputs: {
            messageId: "discordMessageId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_cron",
        target: "action_send_reminder",
      },
    ],
    variables: {
      channelId: {
        type: "string",
        description: "Discord channel ID to send the reminder to",
      },
      message: {
        type: "string",
        default:
          "🔔 Good morning team! Time for standup. Please share your updates.",
        description: "Message to send",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["discord"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "120",
};

/**
 * Discord Webhook Message template.
 * Simple webhook-based message sending (no bot required).
 */
const discordWebhookTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "discord-webhook",
  name: "Discord Webhook Message",
  description:
    "Send a message to Discord when a webhook is received, using the Discord bot integration.",
  longDescription: `
## Discord Webhook Message

Forward incoming webhook events to a Discord channel as messages.

### Use Cases
- CI/CD pipeline alerts
- Monitoring alerts
- Bridge external services to Discord
- Simple event-driven notifications

### Setup Required
1. Connect your Discord bot via the Integrations page
2. Ensure your bot has access to the target channel

### Customization
- Modify the trigger to filter specific webhook events
- Add a template step to format the message
- Add conditions to route events to different channels
`.trim(),
  category: "communication",
  tags: ["discord", "messaging", "webhook", "notifications", "simple"],
  iconUrl: "https://cdn.simpleicons.org/discord",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_1",
        type: "trigger",
        name: "Manual Trigger",
        description: "Start the workflow manually or via API",
        position: { x: 250, y: 50 },
        trigger: {
          type: "manual",
          config: {},
        },
      },
      {
        id: "action_send_discord",
        type: "action",
        name: "Send Discord Message",
        description: "Send the webhook payload as a Discord message",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "discord",
          operation: "send_message",
          inputs: {
            channelId: "{{variables.channelId}}",
            content: "{{variables.message}}",
          },
          outputs: {
            messageId: "discordMessageId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_1",
        target: "action_send_discord",
      },
    ],
    variables: {
      channelId: {
        type: "string",
        description: "Discord channel ID to send the message to",
      },
      message: {
        type: "string",
        default: "Hello from Vortex!",
        description: "Message to send",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["discord"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "105",
};

/**
 * AuthZ Reconciliation workflow template.
 * Syncs authorization tuples between app databases and the AuthZ PDP.
 */
const authzReconcileTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "authz-reconcile",
  name: "AuthZ Reconciliation",
  description:
    "Scheduled reconciliation of authorization tuples between app database and AuthZ PDP.",
  longDescription: `
## AuthZ Reconciliation

Ensures authorization tuples in the PDP (OpenFGA) stay in sync with the source of truth database.

### What it does
1. Calls the app's \`/authz/reconcile\` endpoint
2. Compares expected tuples (from DB) with actual tuples (from PDP)
3. Writes missing tuples
4. Optionally deletes orphaned tuples
5. Reports results and alerts on errors

### Use Cases
- Daily drift detection and correction
- Post-deployment sync verification
- Disaster recovery reconciliation

### Setup Required
1. Set the API base URL variable
2. Configure the service key for authentication
3. Optionally configure Discord webhook for failure alerts
`.trim(),
  category: "operations",
  tags: ["authz", "sync", "reconcile", "cron", "operations", "security"],
  iconUrl: "https://cdn.simpleicons.org/openfga",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_cron",
        type: "trigger",
        name: "Daily at 3 AM UTC",
        description: "Runs reconciliation daily during low-traffic hours",
        position: { x: 250, y: 50 },
        trigger: {
          type: "cron",
          config: {
            expression: "0 3 * * *",
            timezone: "UTC",
          },
        },
      },
      {
        id: "action_reconcile",
        type: "action",
        name: "Call Reconcile Endpoint",
        description: "POST to /authz/reconcile to sync tuples",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.apiBaseUrl}}/authz/reconcile",
            body: {
              deleteOrphans: "{{variables.deleteOrphans}}",
            },
            headers: {
              "Content-Type": "application/json",
              "X-Service-Key": "{{variables.serviceKey}}",
            },
          },
          outputs: {
            status: "responseStatus",
            body: "reconcileResult",
          },
        },
      },
      {
        id: "condition_check_success",
        type: "condition",
        name: "Check Success",
        description: "Verify reconciliation completed successfully",
        position: { x: 250, y: 350 },
        condition: {
          expression: "{{reconcileResult.success}} === true",
          branches: {
            true: "action_log_success",
            false: "action_alert_failure",
          },
        },
      },
      {
        id: "action_log_success",
        type: "action",
        name: "Log Success",
        description: "Log successful reconciliation",
        position: { x: 100, y: 500 },
        action: {
          pluginId: "builtin:log",
          operation: "info",
          inputs: {
            message:
              "AuthZ reconciliation completed: {{reconcileResult.written}} written, {{reconcileResult.deleted}} deleted",
          },
        },
      },
      {
        id: "action_alert_failure",
        type: "action",
        name: "Alert on Failure",
        description: "Send alert when reconciliation fails",
        position: { x: 400, y: 500 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.alertWebhookUrl}}",
            body: {
              content:
                "🚨 AuthZ Reconciliation Failed!\n\nErrors: {{reconcileResult.errors}}\n\nExpected: {{reconcileResult.expected}}, Actual: {{reconcileResult.actual}}",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_cron",
        target: "action_reconcile",
      },
      {
        id: "edge_2",
        source: "action_reconcile",
        target: "condition_check_success",
      },
      {
        id: "edge_3",
        source: "condition_check_success",
        target: "action_log_success",
        label: "success",
      },
      {
        id: "edge_4",
        source: "condition_check_success",
        target: "action_alert_failure",
        label: "failure",
      },
    ],
    variables: {
      apiBaseUrl: {
        type: "string",
        description:
          "Base URL of the app API (e.g., https://api.runa.omni.dev)",
      },
      serviceKey: {
        type: "string",
        description: "X-Service-Key for authentication",
        sensitive: true,
      },
      deleteOrphans: {
        type: "boolean",
        default: false,
        description: "Whether to delete orphaned tuples from PDP",
      },
      alertWebhookUrl: {
        type: "string",
        description: "Discord/Slack webhook URL for failure alerts (optional)",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: false,
  sortOrder: "200",
};

/**
 * Send Slack Message workflow template.
 * Send a message to a Slack channel using the Slack integration.
 */
const slackSendMessageTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "slack-send-message",
  name: "Send Slack Message",
  description:
    "Send a message to a Slack channel using the Slack bot integration.",
  longDescription: `
## Send Slack Message

Send messages to any Slack channel your bot has access to.

### Use Cases
- Post deployment notifications
- Alert on-call engineers
- Share automated reports with your team

### Setup Required
1. Connect your Slack workspace via the Integrations page
2. Invite the bot to the target channel

### Customization
- Change the trigger to webhook, cron, or event
- Add conditional logic to filter messages
- Use template variables for dynamic content
`.trim(),
  category: "communication",
  tags: ["slack", "messaging", "notifications", "bot"],
  iconUrl: "https://cdn.simpleicons.org/slack",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_1",
        type: "trigger",
        name: "Manual Trigger",
        description: "Start the workflow manually or via API",
        position: { x: 250, y: 50 },
        trigger: {
          type: "manual",
          config: {},
        },
      },
      {
        id: "action_send_slack",
        type: "action",
        name: "Send Slack Message",
        description: "Post a message to a Slack channel",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "slack",
          operation: "send_message",
          inputs: {
            channel: "{{variables.channel}}",
            text: "{{variables.message}}",
          },
          outputs: {
            messageId: "slackMessageId",
            ts: "slackTimestamp",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_1",
        target: "action_send_slack",
      },
    ],
    variables: {
      channel: {
        type: "string",
        description: "Slack channel name or ID (e.g., #general)",
      },
      message: {
        type: "string",
        default: "Hello from Vortex!",
        description: "Message text to send",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["slack"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "130",
};

/**
 * GitHub Create Issue workflow template.
 * Create a GitHub issue from a webhook event.
 */
const githubCreateIssueTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "github-create-issue",
  name: "Create GitHub Issue",
  description:
    "Create a GitHub issue when triggered by a webhook, form submission, or other event.",
  longDescription: `
## Create GitHub Issue

Automatically create GitHub issues from external events.

### Use Cases
- Convert support tickets into GitHub issues
- Create issues from form submissions
- Auto-file bugs from monitoring alerts

### Setup Required
1. Connect your GitHub account via the Integrations page
2. Grant access to the target repository

### Customization
- Map webhook payload fields to issue title and body
- Add labels and assignees dynamically
- Chain with other steps for enrichment before creation
`.trim(),
  category: "developer",
  tags: ["github", "issues", "developer", "automation"],
  iconUrl: "https://cdn.simpleicons.org/github",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_webhook",
        type: "trigger",
        name: "Webhook Trigger",
        description: "Receive incoming webhook to create an issue",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {},
        },
      },
      {
        id: "action_create_issue",
        type: "action",
        name: "Create GitHub Issue",
        description: "Create an issue in the target repository",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "github",
          operation: "create_issue",
          inputs: {
            owner: "{{variables.repoOwner}}",
            repo: "{{variables.repoName}}",
            title: "{{trigger.body.title}}",
            body: "{{trigger.body.description}}",
            labels: "{{variables.labels}}",
          },
          outputs: {
            issueNumber: "githubIssueNumber",
            issueUrl: "githubIssueUrl",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_webhook",
        target: "action_create_issue",
      },
    ],
    variables: {
      repoOwner: {
        type: "string",
        description: "GitHub repository owner (user or organization)",
      },
      repoName: {
        type: "string",
        description: "GitHub repository name",
      },
      labels: {
        type: "array",
        default: [],
        description: 'Labels to apply to the issue (e.g., ["bug", "triage"])',
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["github"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "140",
};

/**
 * GitHub PR Slack Notification workflow template.
 * Notify a Slack channel when a pull request event occurs.
 */
const githubPrSlackNotificationTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "github-pr-slack-notification",
  name: "GitHub PR Slack Notification",
  description:
    "Notify a Slack channel when a GitHub pull request is opened, merged, or reviewed.",
  longDescription: `
## GitHub PR Slack Notification

Keep your team informed about pull request activity in Slack.

### What it does
1. Receives a GitHub webhook for PR events
2. Formats a summary with PR title, author, and link
3. Posts the notification to a Slack channel

### Use Cases
- Notify reviewers when PRs are opened
- Alert the team when PRs are merged
- Track review activity in a channel

### Setup Required
1. Connect both GitHub and Slack via the Integrations page
2. Configure a GitHub webhook pointing to this workflow
3. Set the target Slack channel
`.trim(),
  category: "developer",
  tags: ["github", "slack", "pull-request", "notifications", "developer"],
  iconUrl: "https://cdn.simpleicons.org/github",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_webhook",
        type: "trigger",
        name: "GitHub Webhook",
        description: "Receive GitHub pull request events",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {},
        },
      },
      {
        id: "action_format_message",
        type: "action",
        name: "Format PR Message",
        description: "Build a Slack message from the PR payload",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:template",
          operation: "render",
          inputs: {
            template:
              "*{{trigger.body.action}}* PR in `{{trigger.body.repository.full_name}}`\n\n*<{{trigger.body.pull_request.html_url}}|{{trigger.body.pull_request.title}}>*\nby {{trigger.body.pull_request.user.login}}",
          },
          outputs: {
            result: "formattedMessage",
          },
        },
      },
      {
        id: "action_send_slack",
        type: "action",
        name: "Send to Slack",
        description: "Post the PR notification to Slack",
        position: { x: 250, y: 350 },
        action: {
          integrationId: "slack",
          operation: "send_message",
          inputs: {
            channel: "{{variables.slackChannel}}",
            text: "{{formattedMessage}}",
          },
          outputs: {
            messageId: "slackMessageId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_webhook",
        target: "action_format_message",
      },
      {
        id: "edge_2",
        source: "action_format_message",
        target: "action_send_slack",
      },
    ],
    variables: {
      slackChannel: {
        type: "string",
        description: "Slack channel for PR notifications (e.g., #engineering)",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["slack"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "150",
};

/**
 * Webhook Relay workflow template.
 * Forward incoming webhooks to another URL with optional transformation.
 */
const webhookRelayTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "webhook-relay",
  name: "Webhook Relay",
  description:
    "Receive a webhook and forward it to another URL with optional payload transformation.",
  longDescription: `
## Webhook Relay

A simple pass-through that receives webhooks and forwards them to a destination URL.

### Use Cases
- Bridge services that can't talk directly
- Add logging and auditing to webhook traffic
- Fan out a single webhook to multiple destinations
- Transform payloads between incompatible formats

### Setup Required
1. Set the destination URL variable
2. Point the source service's webhook at this workflow's URL

### Customization
- Add a template step to transform the payload before forwarding
- Add conditions to filter which events get forwarded
- Chain multiple destinations for fan-out
`.trim(),
  category: "data",
  tags: ["webhook", "relay", "http", "integration", "proxy"],
  iconUrl: "https://cdn.simpleicons.org/webhook",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_webhook",
        type: "trigger",
        name: "Incoming Webhook",
        description: "Receive the incoming webhook payload",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {},
        },
      },
      {
        id: "action_log_event",
        type: "action",
        name: "Log Event",
        description: "Log the incoming webhook for auditing",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:log",
          operation: "info",
          inputs: {
            message: "Relaying webhook: {{trigger.headers.x-event-type}}",
          },
        },
      },
      {
        id: "action_forward",
        type: "action",
        name: "Forward Webhook",
        description: "POST the payload to the destination URL",
        position: { x: 250, y: 350 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.destinationUrl}}",
            body: "{{trigger.body}}",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-By": "Vortex",
            },
          },
          outputs: {
            status: "responseStatus",
            body: "responseBody",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_webhook",
        target: "action_log_event",
      },
      {
        id: "edge_2",
        source: "action_log_event",
        target: "action_forward",
      },
    ],
    variables: {
      destinationUrl: {
        type: "string",
        description: "URL to forward the webhook payload to",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: false,
  sortOrder: "300",
};

/**
 * API Health Check workflow template.
 * Periodically check an endpoint and alert on failure.
 */
const apiHealthCheckTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "api-health-check",
  name: "API Health Check",
  description:
    "Monitor an API endpoint on a schedule and send alerts when it goes down.",
  longDescription: `
## API Health Check

Periodically ping an endpoint and alert your team when it returns an error.

### What it does
1. Runs on a cron schedule (default: every 5 minutes)
2. Sends a GET request to the target URL
3. Checks if the response status indicates success
4. Sends a webhook alert if the check fails

### Use Cases
- Uptime monitoring for APIs and websites
- Health check validation after deployments
- SLA compliance monitoring

### Setup Required
1. Set the target URL to monitor
2. Set the alert webhook URL (Slack/Discord webhook)

### Customization
- Adjust the cron schedule for check frequency
- Add custom headers for authenticated endpoints
- Modify the success condition for non-standard APIs
`.trim(),
  category: "operations",
  tags: [
    "monitoring",
    "health-check",
    "cron",
    "uptime",
    "alerts",
    "operations",
  ],
  iconUrl: "https://cdn.simpleicons.org/uptimekuma",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_cron",
        type: "trigger",
        name: "Every 5 Minutes",
        description: "Check endpoint every 5 minutes",
        position: { x: 250, y: 50 },
        trigger: {
          type: "cron",
          config: {
            expression: "*/5 * * * *",
            timezone: "UTC",
          },
        },
      },
      {
        id: "action_check_endpoint",
        type: "action",
        name: "Check Endpoint",
        description: "Send GET request to the target URL",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:http",
          operation: "get",
          inputs: {
            url: "{{variables.targetUrl}}",
            headers: {},
          },
          outputs: {
            status: "responseStatus",
            body: "responseBody",
          },
        },
        onError: {
          action: "continue",
        },
      },
      {
        id: "condition_check_status",
        type: "condition",
        name: "Is Healthy?",
        description: "Check if the response indicates success",
        position: { x: 250, y: 350 },
        condition: {
          expression: "{{responseStatus}} >= 200 && {{responseStatus}} < 300",
          branches: {
            true: "action_log_healthy",
            false: "action_alert_down",
          },
        },
      },
      {
        id: "action_log_healthy",
        type: "action",
        name: "Log Healthy",
        description: "Log successful health check",
        position: { x: 100, y: 500 },
        action: {
          pluginId: "builtin:log",
          operation: "info",
          inputs: {
            message:
              "Health check passed: {{variables.targetUrl}} returned {{responseStatus}}",
          },
        },
      },
      {
        id: "action_alert_down",
        type: "action",
        name: "Alert Down",
        description: "Send alert that the endpoint is down",
        position: { x: 400, y: 500 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.alertWebhookUrl}}",
            body: {
              content:
                "🚨 Health check FAILED for {{variables.targetUrl}}\n\nStatus: {{responseStatus}}\nTime: {{trigger.timestamp}}",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_cron",
        target: "action_check_endpoint",
      },
      {
        id: "edge_2",
        source: "action_check_endpoint",
        target: "condition_check_status",
      },
      {
        id: "edge_3",
        source: "condition_check_status",
        target: "action_log_healthy",
        label: "healthy",
      },
      {
        id: "edge_4",
        source: "condition_check_status",
        target: "action_alert_down",
        label: "down",
      },
    ],
    variables: {
      targetUrl: {
        type: "string",
        description: "URL to monitor (e.g., https://api.example.com/health)",
      },
      alertWebhookUrl: {
        type: "string",
        description: "Slack or Discord webhook URL for failure alerts",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "210",
};

/**
 * RSS Feed Notification workflow template.
 * Poll an RSS feed and send new items to a webhook.
 */
const rssFeedNotificationTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "rss-feed-notification",
  name: "RSS Feed Notification",
  description:
    "Poll an RSS feed on a schedule and send new items to Slack, Discord, or any webhook.",
  longDescription: `
## RSS Feed Notification

Stay on top of RSS feeds by forwarding new items to your team's chat.

### What it does
1. Polls an RSS feed URL on a schedule
2. Parses the XML response into structured items
3. Sends the latest item to a webhook destination

### Use Cases
- Track blog posts from competitors or partners
- Monitor release notes for dependencies
- Follow news feeds relevant to your project

### Setup Required
1. Set the RSS feed URL
2. Set the destination webhook URL (Slack/Discord)

### Customization
- Adjust the polling frequency via the cron expression
- Add filtering to only forward items matching keywords
- Format the output message for your chat platform
`.trim(),
  category: "data",
  tags: ["rss", "feed", "polling", "notifications", "automation"],
  iconUrl: "https://cdn.simpleicons.org/rss",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_cron",
        type: "trigger",
        name: "Every 30 Minutes",
        description: "Poll the RSS feed every 30 minutes",
        position: { x: 250, y: 50 },
        trigger: {
          type: "cron",
          config: {
            expression: "*/30 * * * *",
            timezone: "UTC",
          },
        },
      },
      {
        id: "action_fetch_feed",
        type: "action",
        name: "Fetch RSS Feed",
        description: "Download the RSS feed XML",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:http",
          operation: "get",
          inputs: {
            url: "{{variables.feedUrl}}",
            headers: {
              Accept: "application/rss+xml, application/xml, text/xml",
            },
          },
          outputs: {
            body: "feedXml",
          },
        },
      },
      {
        id: "action_parse_feed",
        type: "action",
        name: "Parse Feed",
        description: "Parse the RSS XML into structured data",
        position: { x: 250, y: 350 },
        action: {
          pluginId: "builtin:parse",
          operation: "xml",
          inputs: {
            source: "{{feedXml}}",
          },
          outputs: {
            result: "feedData",
          },
        },
      },
      {
        id: "action_notify",
        type: "action",
        name: "Send Notification",
        description: "Post the latest item to the webhook",
        position: { x: 250, y: 500 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.webhookUrl}}",
            body: {
              content:
                "📰 New RSS item: *{{feedData.rss.channel.item[0].title}}*\n{{feedData.rss.channel.item[0].link}}",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
          outputs: {
            status: "notifyStatus",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_cron",
        target: "action_fetch_feed",
      },
      {
        id: "edge_2",
        source: "action_fetch_feed",
        target: "action_parse_feed",
      },
      {
        id: "edge_3",
        source: "action_parse_feed",
        target: "action_notify",
      },
    ],
    variables: {
      feedUrl: {
        type: "string",
        description: "RSS feed URL to poll",
      },
      webhookUrl: {
        type: "string",
        description: "Slack or Discord webhook URL to send new items to",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: false,
  sortOrder: "310",
};

/**
 * AI Content Summarizer workflow template.
 * Summarize text content using an LLM.
 */
const aiContentSummarizerTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "ai-content-summarizer",
  name: "AI Content Summarizer",
  description:
    "Summarize text content using an LLM via webhook trigger or manual invocation.",
  longDescription: `
## AI Content Summarizer

Send text to this workflow and receive a concise summary powered by an LLM.

### What it does
1. Receives text content via webhook or manual trigger
2. Sends the content to an LLM for summarization
3. Returns the summary as the workflow output

### Use Cases
- Summarize long support tickets before routing
- Create daily digests from multiple data sources
- Condense meeting transcripts into action items

### Setup Required
1. Connect your OpenAI account via the Integrations page

### Customization
- Change the summarization style (brief, detailed, bullets)
- Swap OpenAI for Anthropic or another AI provider
- Chain with other steps to route summaries to Slack, email, etc.
`.trim(),
  category: "ai",
  tags: ["ai", "llm", "summarize", "text", "nlp"],
  iconUrl: "https://cdn.simpleicons.org/openai",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_webhook",
        type: "trigger",
        name: "Webhook Trigger",
        description: "Receive text content to summarize",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {},
        },
      },
      {
        id: "action_summarize",
        type: "action",
        name: "Summarize Content",
        description: "Use OpenAI to generate a summary",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "openai",
          operation: "ask_chatgpt",
          inputs: {
            prompt:
              "Summarize the following content in a concise paragraph. Focus on key points and actionable information.\n\nContent:\n{{trigger.body.content}}",
          },
          outputs: {
            result: "summary",
          },
        },
      },
      {
        id: "action_respond",
        type: "action",
        name: "Return Summary",
        description: "Respond with the generated summary",
        position: { x: 250, y: 350 },
        action: {
          pluginId: "builtin:webhookResponse",
          operation: "respond",
          inputs: {
            statusCode: 200,
            body: {
              summary: "{{summary}}",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_webhook",
        target: "action_summarize",
      },
      {
        id: "edge_2",
        source: "action_summarize",
        target: "action_respond",
      },
    ],
    variables: {},
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: ["openai"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "400",
};

/**
 * AI Sentiment Classifier workflow template.
 * Classify text sentiment using an LLM.
 */
const aiSentimentClassifierTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "ai-sentiment-classifier",
  name: "AI Sentiment Classifier",
  description:
    "Classify incoming text as positive, negative, or neutral using an LLM.",
  longDescription: `
## AI Sentiment Classifier

Analyze the sentiment of incoming text and route it based on the result.

### What it does
1. Receives text via webhook
2. Classifies sentiment as positive, negative, or neutral
3. Routes to different actions based on the classification

### Use Cases
- Triage support tickets by urgency and tone
- Monitor social mentions for brand sentiment
- Flag negative customer feedback for immediate review

### Setup Required
1. Connect your OpenAI account via the Integrations page

### Customization
- Add custom categories beyond positive/negative/neutral
- Route each sentiment to different channels or handlers
- Combine with other data sources for richer analysis
`.trim(),
  category: "ai",
  tags: ["ai", "llm", "classify", "sentiment", "nlp", "text"],
  iconUrl: "https://cdn.simpleicons.org/openai",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_webhook",
        type: "trigger",
        name: "Webhook Trigger",
        description: "Receive text to classify",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {},
        },
      },
      {
        id: "action_classify",
        type: "action",
        name: "Classify Sentiment",
        description: "Use OpenAI to classify sentiment",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "openai",
          operation: "ask_chatgpt",
          inputs: {
            prompt:
              'Classify the sentiment of the following text as exactly one of: "positive", "negative", or "neutral". Respond with only the classification word.\n\nText:\n{{trigger.body.text}}',
          },
          outputs: {
            result: "sentiment",
          },
        },
      },
      {
        id: "condition_route",
        type: "condition",
        name: "Is Negative?",
        description: "Check if the sentiment is negative",
        position: { x: 250, y: 350 },
        condition: {
          expression: '{{sentiment}} === "negative"',
          branches: {
            true: "action_alert_negative",
            false: "action_log_result",
          },
        },
      },
      {
        id: "action_alert_negative",
        type: "action",
        name: "Alert on Negative",
        description: "Send an alert for negative sentiment",
        position: { x: 400, y: 500 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.alertWebhookUrl}}",
            body: {
              content:
                "⚠️ Negative sentiment detected:\n\n> {{trigger.body.text}}\n\nClassification: {{sentiment}}",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        },
      },
      {
        id: "action_log_result",
        type: "action",
        name: "Log Result",
        description: "Log non-negative classification",
        position: { x: 100, y: 500 },
        action: {
          pluginId: "builtin:log",
          operation: "info",
          inputs: {
            message: "Sentiment classified as {{sentiment}}",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_webhook",
        target: "action_classify",
      },
      {
        id: "edge_2",
        source: "action_classify",
        target: "condition_route",
      },
      {
        id: "edge_3",
        source: "condition_route",
        target: "action_alert_negative",
        label: "negative",
      },
      {
        id: "edge_4",
        source: "condition_route",
        target: "action_log_result",
        label: "other",
      },
    ],
    variables: {
      alertWebhookUrl: {
        type: "string",
        description:
          "Webhook URL to alert on negative sentiment (Slack/Discord)",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: ["openai"],
  isPublic: true,
  isFeatured: false,
  sortOrder: "410",
};

/**
 * Webhook AI Responder workflow template.
 * Process incoming webhooks with AI and return a response.
 */
const webhookAiResponderTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "webhook-ai-responder",
  name: "Webhook AI Responder",
  description:
    "Receive a webhook, process the payload with an LLM, and return the AI-generated response.",
  longDescription: `
## Webhook AI Responder

Build an AI-powered API endpoint that processes requests with an LLM and responds synchronously.

### What it does
1. Receives a webhook request with a question or prompt
2. Sends it to an LLM with a configurable system prompt
3. Returns the AI response as the webhook response

### Use Cases
- Build a custom AI chatbot endpoint
- Create an AI-powered API for your application
- Process and answer questions from forms or support widgets

### Setup Required
1. Connect your OpenAI account via the Integrations page

### Customization
- Modify the system prompt to change AI behavior
- Swap OpenAI for Anthropic or another AI provider
- Chain with other steps for post-processing
`.trim(),
  category: "ai",
  tags: ["ai", "llm", "webhook", "api", "chatbot", "responder"],
  iconUrl: "https://cdn.simpleicons.org/openai",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_webhook",
        type: "trigger",
        name: "Webhook Trigger",
        description: "Receive a request to process with AI",
        position: { x: 250, y: 50 },
        trigger: {
          type: "webhook",
          config: {},
        },
      },
      {
        id: "action_ai_process",
        type: "action",
        name: "Process with AI",
        description: "Send the request to OpenAI for processing",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "openai",
          operation: "ask_chatgpt",
          inputs: {
            prompt: "{{variables.systemPrompt}}\n\n{{trigger.body.message}}",
          },
          outputs: {
            result: "aiResponse",
          },
        },
      },
      {
        id: "action_respond",
        type: "action",
        name: "Return Response",
        description: "Send the AI response back to the caller",
        position: { x: 250, y: 350 },
        action: {
          pluginId: "builtin:webhookResponse",
          operation: "respond",
          inputs: {
            statusCode: 200,
            body: {
              response: "{{aiResponse}}",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_webhook",
        target: "action_ai_process",
      },
      {
        id: "edge_2",
        source: "action_ai_process",
        target: "action_respond",
      },
    ],
    variables: {
      systemPrompt: {
        type: "string",
        default:
          "You are a helpful assistant. Answer questions clearly and concisely.",
        description: "System prompt to guide the AI behavior",
      },
    },
    settings: {
      timeout: "120s",
    },
  },
  requiredIntegrations: ["openai"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "420",
};

/**
 * Deploy Notification workflow template.
 * Trigger on deploy.succeeded event and send a Slack notification.
 */
const deployNotificationTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "deploy-notification",
  name: "Deploy Notification",
  description:
    "Send a Slack notification when a deployment succeeds, with service name, environment, and commit info.",
  longDescription: `
## Deploy Notification

Get notified in Slack every time a deployment completes successfully.

### What it does
1. Listens for \`deploy.succeeded\` events from your CI/CD pipeline
2. Formats a rich notification with service name, environment, and commit SHA
3. Posts the notification to a Slack channel

### Use Cases
- Keep engineering informed about production deploys
- Track deployment frequency across services
- Create an audit trail of what shipped and when

### Setup Required
1. Connect your Slack workspace via the Integrations page
2. Create an event routing rule for \`deploy.succeeded\` events
3. Set the target Slack channel

### Customization
- Add more event types (\`deploy.failed\`, \`deploy.started\`)
- Include links to the deployment dashboard
- Chain with other steps to run post-deploy checks
`.trim(),
  category: "operations",
  tags: ["deploy", "slack", "notifications", "ci-cd", "operations"],
  iconUrl: "https://cdn.simpleicons.org/railway",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_event",
        type: "trigger",
        name: "Deploy Succeeded Event",
        description: "Triggered when a deploy.succeeded event is received",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            eventType: "deploy.succeeded",
          },
        },
      },
      {
        id: "action_format",
        type: "action",
        name: "Format Notification",
        description: "Build a deploy notification message",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:template",
          operation: "render",
          inputs: {
            template:
              "Deployed *{{trigger.data.service}}* to `{{trigger.data.environment}}`\n\nCommit: `{{trigger.data.commitSha}}`\nBy: {{trigger.data.actor}}",
          },
          outputs: {
            result: "formattedMessage",
          },
        },
      },
      {
        id: "action_send_slack",
        type: "action",
        name: "Send to Slack",
        description: "Post the deploy notification to Slack",
        position: { x: 250, y: 350 },
        action: {
          integrationId: "slack",
          operation: "send_message",
          inputs: {
            channel: "{{variables.slackChannel}}",
            text: "{{formattedMessage}}",
          },
          outputs: {
            messageId: "slackMessageId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_event",
        target: "action_format",
      },
      {
        id: "edge_2",
        source: "action_format",
        target: "action_send_slack",
      },
    ],
    variables: {
      slackChannel: {
        type: "string",
        description: "Slack channel for deploy notifications (e.g., #deploys)",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["slack"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "500",
};

/**
 * New User Onboarding workflow template.
 * Trigger on IDP member.added event and send a welcome email via Resend.
 */
const newUserOnboardingTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "new-user-onboarding",
  name: "New User Onboarding",
  description:
    "Send a welcome email when a new member is added to the identity provider.",
  longDescription: `
## New User Onboarding

Automatically welcome new team members with a personalized onboarding email.

### What it does
1. Listens for \`member.added\` events from Hidra (IDP)
2. Formats a welcome email with the member's name and useful links
3. Sends the email via Resend

### Use Cases
- Welcome new organization members with getting-started links
- Notify admins when new members join
- Trigger onboarding checklists and provisioning flows

### Setup Required
1. Connect your Resend account via the Integrations page
2. Create an event routing rule for \`member.added\` events
3. Set the sender email address

### Customization
- Customize the email template with your branding
- Add steps to provision accounts in other services
- Chain with Slack to notify the team about new members
`.trim(),
  category: "communication",
  tags: [
    "onboarding",
    "email",
    "resend",
    "welcome",
    "idp",
    "member",
    "automation",
  ],
  iconUrl: "https://cdn.simpleicons.org/resend",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_event",
        type: "trigger",
        name: "Member Added Event",
        description: "Triggered when a member.added event is received from IDP",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            eventType: "member.added",
          },
        },
      },
      {
        id: "action_send_email",
        type: "action",
        name: "Send Welcome Email",
        description: "Send a welcome email to the new member via Resend",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "resend",
          operation: "send_email",
          inputs: {
            from: "{{variables.senderEmail}}",
            to: "{{trigger.data.email}}",
            subject: "Welcome to {{variables.organizationName}}!",
            html: '<h1>Welcome, {{trigger.data.name}}!</h1><p>You\'ve been added to <strong>{{variables.organizationName}}</strong>.</p><p>Here are some links to get you started:</p><ul><li><a href="{{variables.dashboardUrl}}">Dashboard</a></li><li><a href="{{variables.docsUrl}}">Documentation</a></li></ul><p>If you have any questions, reach out to your team lead.</p>',
          },
          outputs: {
            emailId: "emailId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_event",
        target: "action_send_email",
      },
    ],
    variables: {
      senderEmail: {
        type: "string",
        default: "team@omni.dev",
        description: "Sender email address",
      },
      organizationName: {
        type: "string",
        default: "Omni",
        description: "Organization name for the welcome email",
      },
      dashboardUrl: {
        type: "string",
        description: "Link to the main dashboard",
      },
      docsUrl: {
        type: "string",
        description: "Link to documentation",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: ["resend"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "510",
};

/**
 * Daily Audit Digest workflow template.
 * Cron-triggered daily digest that queries Chronicle and emails a summary.
 */
const auditDigestTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "audit-digest",
  name: "Daily Audit Digest",
  description:
    "Query Chronicle for daily audit events and email a formatted summary to stakeholders.",
  longDescription: `
## Daily Audit Digest

Get a daily email summary of audit events across your Omni services.

### What it does
1. Runs on a daily cron schedule (default: 8 AM UTC)
2. Queries Chronicle's GraphQL API for the past 24 hours of events
3. Formats the events into a readable HTML digest
4. Sends the digest via email using Resend

### Use Cases
- Daily security review of sensitive operations
- Compliance reporting for audit trails
- Executive summary of platform activity
- Anomaly detection (unusually high event counts)

### Setup Required
1. Set the Chronicle API URL
2. Connect your Resend account via the Integrations page
3. Set recipient email addresses

### Customization
- Adjust the cron schedule for different frequencies
- Filter to specific event types or severity levels
- Add Slack notification alongside email
- Include charts or metrics from other sources
`.trim(),
  category: "operations",
  tags: [
    "audit",
    "chronicle",
    "digest",
    "email",
    "cron",
    "compliance",
    "reporting",
  ],
  iconUrl: "https://cdn.simpleicons.org/simpleanalytics",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_cron",
        type: "trigger",
        name: "Daily at 8 AM UTC",
        description: "Runs the audit digest every morning",
        position: { x: 250, y: 50 },
        trigger: {
          type: "cron",
          config: {
            expression: "0 8 * * *",
            timezone: "UTC",
          },
        },
      },
      {
        id: "action_query_chronicle",
        type: "action",
        name: "Query Chronicle",
        description: "Fetch audit events from the past 24 hours",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.chronicleApiUrl}}/graphql",
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              query:
                "query AuditDigest($since: DateTime!) { auditEvents(filter: { since: $since }) { totalCount events { id type actor { name email } target { type id } timestamp metadata } } }",
              variables: {
                since: "{{trigger.timestamp | dateSubtract: '24h'}}",
              },
            },
          },
          outputs: {
            body: "chronicleResponse",
          },
        },
      },
      {
        id: "action_format_digest",
        type: "action",
        name: "Format Digest",
        description: "Build an HTML email from the audit events",
        position: { x: 250, y: 350 },
        action: {
          pluginId: "builtin:template",
          operation: "render",
          inputs: {
            template:
              '<h2>Daily Audit Digest</h2><p><strong>Period:</strong> Past 24 hours</p><p><strong>Total events:</strong> {{chronicleResponse.data.auditEvents.totalCount}}</p><hr/><p>Review the full audit log at <a href="{{variables.chronicleApiUrl}}">Chronicle</a>.</p>',
          },
          outputs: {
            result: "digestHtml",
          },
        },
      },
      {
        id: "action_send_email",
        type: "action",
        name: "Send Digest Email",
        description: "Email the formatted digest via Resend",
        position: { x: 250, y: 500 },
        action: {
          integrationId: "resend",
          operation: "send_email",
          inputs: {
            from: "{{variables.senderEmail}}",
            to: "{{variables.recipientEmails}}",
            subject:
              "Daily Audit Digest - {{trigger.timestamp | dateFormat: 'YYYY-MM-DD'}}",
            html: "{{digestHtml}}",
          },
          outputs: {
            emailId: "emailId",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_cron",
        target: "action_query_chronicle",
      },
      {
        id: "edge_2",
        source: "action_query_chronicle",
        target: "action_format_digest",
      },
      {
        id: "edge_3",
        source: "action_format_digest",
        target: "action_send_email",
      },
    ],
    variables: {
      chronicleApiUrl: {
        type: "string",
        default: "https://api.chronicle.omni.dev",
        description: "Chronicle API base URL",
      },
      senderEmail: {
        type: "string",
        default: "digest@omni.dev",
        description: "Sender email address for the digest",
      },
      recipientEmails: {
        type: "array",
        description: "Email addresses to receive the digest",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: ["resend"],
  isPublic: true,
  isFeatured: true,
  sortOrder: "520",
};

/**
 * Cross-Product: New User Onboarding (Gatekeeper -> Aether -> Notification).
 * Provision entitlements and send welcome email when a user is created.
 */
const crossProductOnboardingTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "cross-product-user-onboarding",
  name: "Cross-Product User Onboarding",
  description:
    "Provision entitlements and send a welcome email when a new user is created in Gatekeeper.",
  longDescription: `
## Cross-Product User Onboarding

End-to-end onboarding across Omni services when a new user signs up.

### What it does
1. Listens for \`gatekeeper.user.created\` events
2. Emits an entitlement creation event for Aether
3. Sends a welcome email notification
4. Logs the onboarding to the audit trail

### Cross-Product Integration
- **Gatekeeper** (trigger) — user identity events
- **Aether** (action) — entitlement provisioning
- **Notification** — welcome email delivery

### Setup Required
1. Ensure Gatekeeper emits \`gatekeeper.user.created\` events
2. Configure Aether webhook subscription for entitlement events
3. Set sender email and organization details

### Customization
- Add Slack notification to alert the team
- Chain with Runa to create an onboarding task
- Add a delay before sending a follow-up tips email
`.trim(),
  category: "identity",
  tags: [
    "onboarding",
    "gatekeeper",
    "aether",
    "entitlements",
    "cross-product",
    "email",
  ],
  iconUrl: "https://cdn.simpleicons.org/shield",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_user_created",
        type: "trigger",
        name: "User Created",
        description: "Triggered when a new user is created in Gatekeeper",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            source: "gatekeeper-app",
            eventType: "gatekeeper.user.created",
          },
        },
      },
      {
        id: "action_emit_entitlement",
        type: "action",
        name: "Emit Entitlement Creation",
        description:
          "Emit an event to provision default entitlements for the new user",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.vortexApiUrl}}/api/events",
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              specversion: "1.0",
              type: "aether.entitlement.create",
              source: "vortex-worker",
              data: {
                organizationId: "{{trigger.data.organizationId}}",
                userId: "{{trigger.data.id}}",
                plan: "{{variables.defaultPlan}}",
              },
            },
          },
          outputs: {
            status: "emitStatus",
          },
        },
      },
      {
        id: "notify_welcome",
        type: "notification",
        name: "Send Welcome Email",
        description: "Send a welcome email to the new user",
        position: { x: 250, y: 350 },
        notification: {
          channel: "email",
          recipients: ["{{trigger.data.email}}"],
          title: "Welcome to {{variables.organizationName}}!",
          message:
            "Hi {{trigger.data.name}}, welcome to {{variables.organizationName}}. Your account is ready and entitlements have been provisioned.",
          priority: "normal",
        },
      },
      {
        id: "log_onboarding",
        type: "log",
        name: "Log Onboarding",
        description: "Record the onboarding event in the audit trail",
        position: { x: 250, y: 500 },
        log: {
          level: "info",
          message:
            "User onboarded: {{trigger.data.email}} ({{trigger.data.id}})",
          data: {
            userId: "{{trigger.data.id}}",
            email: "{{trigger.data.email}}",
            plan: "{{variables.defaultPlan}}",
          },
          tags: ["onboarding", "cross-product"],
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_user_created",
        target: "action_emit_entitlement",
      },
      {
        id: "edge_2",
        source: "action_emit_entitlement",
        target: "notify_welcome",
      },
      {
        id: "edge_3",
        source: "notify_welcome",
        target: "log_onboarding",
      },
    ],
    variables: {
      vortexApiUrl: {
        type: "string",
        default: "https://api.vortex.omni.dev",
        description: "Vortex API base URL for event emission",
      },
      defaultPlan: {
        type: "string",
        default: "free",
        description: "Default entitlement plan for new users",
      },
      organizationName: {
        type: "string",
        default: "Omni",
        description: "Organization name for welcome messaging",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "600",
};

/**
 * Cross-Product: Subscription Changed (Aether -> Condition -> Notification).
 * Route upgrade vs downgrade flows when a subscription changes.
 */
const crossProductSubscriptionChangedTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "cross-product-subscription-changed",
  name: "Subscription Changed Handler",
  description:
    "Handle subscription upgrades and downgrades with conditional entitlement updates and user notifications.",
  longDescription: `
## Subscription Changed Handler

React to Aether subscription changes with branching logic for upgrades vs downgrades.

### What it does
1. Listens for \`aether.subscription.changed\` events
2. Evaluates whether the change is an upgrade or downgrade
3. Updates entitlements accordingly
4. Notifies the user about their plan change

### Cross-Product Integration
- **Aether** (trigger) — subscription lifecycle events
- **Aether** (action) — entitlement updates
- **Notification** — user-facing plan change alerts

### Setup Required
1. Ensure Aether emits \`aether.subscription.changed\` with \`previousPlan\` and \`newPlan\`
2. Configure notification channels (email or Slack)

### Customization
- Add a delay before downgrade to allow grace period
- Chain with billing to issue prorated credits
- Send different messages for trial-to-paid conversions
`.trim(),
  category: "billing",
  tags: [
    "aether",
    "subscription",
    "billing",
    "entitlements",
    "cross-product",
    "conditional",
  ],
  iconUrl: "https://cdn.simpleicons.org/stripe",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_subscription",
        type: "trigger",
        name: "Subscription Changed",
        description: "Triggered when a subscription changes in Aether",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            source: "aether",
            eventType: "aether.subscription.changed",
          },
        },
      },
      {
        id: "condition_upgrade",
        type: "condition",
        name: "Upgrade or Downgrade?",
        description: "Check if the plan change is an upgrade or downgrade",
        position: { x: 250, y: 200 },
        condition: {
          expression:
            "{{trigger.data.newPlan.tier}} > {{trigger.data.previousPlan.tier}}",
          trueBranch: "action_upgrade_entitlements",
          falseBranch: "action_downgrade_entitlements",
        },
      },
      {
        id: "action_upgrade_entitlements",
        type: "action",
        name: "Update Entitlements (Upgrade)",
        description: "Expand entitlements for the upgraded plan",
        position: { x: 100, y: 350 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.vortexApiUrl}}/api/events",
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              specversion: "1.0",
              type: "aether.entitlement.updated",
              source: "vortex-worker",
              data: {
                organizationId: "{{trigger.data.organizationId}}",
                plan: "{{trigger.data.newPlan.id}}",
                action: "expand",
              },
            },
          },
          outputs: {
            status: "upgradeStatus",
          },
        },
      },
      {
        id: "action_downgrade_entitlements",
        type: "action",
        name: "Update Entitlements (Downgrade)",
        description: "Restrict entitlements for the downgraded plan",
        position: { x: 400, y: 350 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.vortexApiUrl}}/api/events",
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              specversion: "1.0",
              type: "aether.entitlement.updated",
              source: "vortex-worker",
              data: {
                organizationId: "{{trigger.data.organizationId}}",
                plan: "{{trigger.data.newPlan.id}}",
                action: "restrict",
              },
            },
          },
          outputs: {
            status: "downgradeStatus",
          },
        },
      },
      {
        id: "notify_upgrade",
        type: "notification",
        name: "Notify User (Upgrade)",
        description: "Congratulate the user on their upgrade",
        position: { x: 100, y: 500 },
        notification: {
          channel: "email",
          recipients: ["{{trigger.data.ownerEmail}}"],
          title: "Plan Upgraded!",
          message:
            "Your plan has been upgraded to {{trigger.data.newPlan.name}}. New features are now available.",
          priority: "normal",
        },
      },
      {
        id: "notify_downgrade",
        type: "notification",
        name: "Notify User (Downgrade)",
        description: "Inform the user about their downgrade",
        position: { x: 400, y: 500 },
        notification: {
          channel: "email",
          recipients: ["{{trigger.data.ownerEmail}}"],
          title: "Plan Changed",
          message:
            "Your plan has been changed to {{trigger.data.newPlan.name}}. Some features may no longer be available.",
          priority: "normal",
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_subscription",
        target: "condition_upgrade",
      },
      {
        id: "edge_2",
        source: "action_upgrade_entitlements",
        target: "notify_upgrade",
      },
      {
        id: "edge_3",
        source: "action_downgrade_entitlements",
        target: "notify_downgrade",
      },
    ],
    variables: {
      vortexApiUrl: {
        type: "string",
        default: "https://api.vortex.omni.dev",
        description: "Vortex API base URL for event emission",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "610",
};

/**
 * Cross-Product: Feedback-to-Task (Backfeed -> LLM Classify -> Runa).
 * Classify incoming feedback and create tasks for bugs.
 */
const crossProductFeedbackToTaskTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "cross-product-feedback-to-task",
  name: "Feedback to Task",
  description:
    "Classify feedback with AI and automatically create tasks in Runa for bugs.",
  longDescription: `
## Feedback to Task

Use AI to triage incoming feedback and route bugs to your task tracker.

### What it does
1. Listens for \`backfeed.feedback.created\` events
2. Uses an LLM to classify the feedback as bug, feature, or question
3. If it's a bug, creates a task in Runa
4. Notifies the team about newly triaged feedback

### Cross-Product Integration
- **Backfeed** (trigger) — user feedback events
- **LLM** (classify) — AI-powered triage
- **Runa** (action) — task creation for bugs
- **Notification** — team alerts

### Setup Required
1. Ensure Backfeed emits \`backfeed.feedback.created\` events
2. Configure an LLM server for classification
3. Set the Runa API URL and project details

### Customization
- Add more categories (security, documentation, UX)
- Route feature requests to a separate board
- Auto-respond to questions with relevant docs
`.trim(),
  category: "productivity",
  tags: [
    "backfeed",
    "runa",
    "feedback",
    "ai",
    "classification",
    "cross-product",
    "triage",
  ],
  iconUrl: "https://cdn.simpleicons.org/openai",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_feedback",
        type: "trigger",
        name: "Feedback Created",
        description: "Triggered when new feedback is submitted in Backfeed",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            source: "backfeed-api",
            eventType: "backfeed.feedback.created",
          },
        },
      },
      {
        id: "classify_feedback",
        type: "classify",
        name: "Classify Feedback",
        description: "Use AI to classify feedback as bug, feature, or question",
        position: { x: 250, y: 200 },
        classify: {
          input: "{{trigger.data.title}} {{trigger.data.body}}",
          categories: ["bug", "feature", "question"],
          multiLabel: false,
          outputVariable: "feedbackCategory",
        },
      },
      {
        id: "condition_is_bug",
        type: "condition",
        name: "Is Bug?",
        description: "Route bugs to Runa for task creation",
        position: { x: 250, y: 350 },
        condition: {
          expression: "{{feedbackCategory}} == 'bug'",
          trueBranch: "action_create_task",
          falseBranch: "notify_team",
        },
      },
      {
        id: "action_create_task",
        type: "action",
        name: "Create Runa Task",
        description: "Create a bug task in Runa from the feedback",
        position: { x: 100, y: 500 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.runaApiUrl}}/graphql",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer {{variables.runaApiKey}}",
            },
            body: {
              query:
                "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id } }",
              variables: {
                input: {
                  title: "[Bug] {{trigger.data.title}}",
                  description:
                    "Auto-created from Backfeed feedback #{{trigger.data.id}}\n\n{{trigger.data.body}}",
                  projectId: "{{variables.runaProjectId}}",
                  priority: "high",
                  labels: ["bug", "auto-triage"],
                },
              },
            },
          },
          outputs: {
            body: "taskResult",
          },
        },
      },
      {
        id: "notify_team",
        type: "notification",
        name: "Notify Team",
        description: "Alert the team about newly triaged feedback",
        position: { x: 400, y: 500 },
        notification: {
          channel: "slack",
          recipients: ["{{variables.slackChannel}}"],
          title: "Feedback Triaged: {{feedbackCategory}}",
          message:
            'New {{feedbackCategory}} from Backfeed: "{{trigger.data.title}}"',
          priority: "normal",
          data: {
            feedbackId: "{{trigger.data.id}}",
            category: "{{feedbackCategory}}",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_feedback",
        target: "classify_feedback",
      },
      {
        id: "edge_2",
        source: "classify_feedback",
        target: "condition_is_bug",
      },
      {
        id: "edge_3",
        source: "action_create_task",
        target: "notify_team",
      },
    ],
    variables: {
      runaApiUrl: {
        type: "string",
        default: "https://api.runa.omni.dev",
        description: "Runa API base URL",
      },
      runaApiKey: {
        type: "string",
        description: "Runa API key for task creation",
        sensitive: true,
      },
      runaProjectId: {
        type: "string",
        description: "Runa project ID for bug tasks",
      },
      slackChannel: {
        type: "string",
        default: "#feedback-triage",
        description: "Slack channel for triage notifications",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "620",
};

/**
 * Cross-Product: Deploy & Verify (Arbor -> Deploy -> Health Check -> Alert).
 * Deploy on push to main, then verify with a health check.
 */
const crossProductDeployVerifyTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "cross-product-deploy-verify",
  name: "Deploy & Verify",
  description:
    "Deploy on push to main via Arbor, wait, then run a health check with conditional alerting.",
  longDescription: `
## Deploy & Verify

Automated deploy-and-verify pipeline triggered by git pushes.

### What it does
1. Listens for \`arbor.ref.created\` events
2. Checks if the ref is the main branch
3. Triggers a deploy via HTTP
4. Waits 30 seconds for the deploy to settle
5. Runs a health check against the deployed service
6. Alerts the team if the health check fails

### Cross-Product Integration
- **Arbor** (trigger) — git ref events
- **Fractal** (action) — deployment API
- **Notification** — success/failure alerts

### Setup Required
1. Ensure Arbor emits \`arbor.ref.created\` events
2. Configure the deploy and health check URLs
3. Set the notification channel for alerts

### Customization
- Adjust the delay duration for slower deployments
- Add rollback steps on health check failure
- Chain with Synapse for deployment analytics
`.trim(),
  category: "operations",
  tags: [
    "arbor",
    "deploy",
    "health-check",
    "cross-product",
    "ci-cd",
    "verification",
  ],
  iconUrl: "https://cdn.simpleicons.org/githubactions",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_ref",
        type: "trigger",
        name: "Ref Created",
        description: "Triggered when a new ref is pushed in Arbor",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            source: "arbor-api",
            eventType: "arbor.ref.created",
          },
        },
      },
      {
        id: "condition_main",
        type: "condition",
        name: "Is Main Branch?",
        description: "Only deploy for pushes to main",
        position: { x: 250, y: 200 },
        condition: {
          expression: "{{trigger.data.ref}} == 'refs/heads/main'",
          trueBranch: "action_deploy",
          falseBranch: "log_skip",
        },
      },
      {
        id: "action_deploy",
        type: "action",
        name: "Trigger Deploy",
        description: "Call the deploy API to start a deployment",
        position: { x: 150, y: 350 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.deployUrl}}",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer {{variables.deployToken}}",
            },
            body: {
              repository: "{{trigger.data.repository}}",
              ref: "{{trigger.data.ref}}",
              commitSha: "{{trigger.data.commitSha}}",
            },
          },
          outputs: {
            status: "deployStatus",
          },
        },
      },
      {
        id: "delay_settle",
        type: "delay",
        name: "Wait for Deploy",
        description: "Wait 30 seconds for the deploy to settle",
        position: { x: 150, y: 500 },
        delay: {
          duration: 30,
          unit: "seconds",
        },
      },
      {
        id: "action_health_check",
        type: "action",
        name: "Health Check",
        description: "Verify the deployed service is healthy",
        position: { x: 150, y: 650 },
        action: {
          pluginId: "builtin:http",
          operation: "get",
          inputs: {
            url: "{{variables.healthCheckUrl}}",
          },
          outputs: {
            status: "healthStatus",
            body: "healthResponse",
          },
        },
      },
      {
        id: "condition_healthy",
        type: "condition",
        name: "Is Healthy?",
        description: "Check if the health endpoint returned OK",
        position: { x: 150, y: 800 },
        condition: {
          expression: "{{healthStatus}} == 200",
          trueBranch: "notify_success",
          falseBranch: "notify_failure",
        },
      },
      {
        id: "notify_success",
        type: "notification",
        name: "Deploy Succeeded",
        description: "Notify the team of a successful deploy",
        position: { x: 50, y: 950 },
        notification: {
          channel: "slack",
          recipients: ["{{variables.slackChannel}}"],
          title: "Deploy Succeeded",
          message:
            "{{trigger.data.repository}} deployed to main ({{trigger.data.commitSha}}) and health check passed.",
          priority: "normal",
        },
      },
      {
        id: "notify_failure",
        type: "notification",
        name: "Deploy Failed Health Check",
        description: "Alert the team that the health check failed",
        position: { x: 300, y: 950 },
        notification: {
          channel: "slack",
          recipients: ["{{variables.slackChannel}}"],
          title: "Deploy Health Check Failed!",
          message:
            "{{trigger.data.repository}} deployed but health check returned {{healthStatus}}. Investigate immediately.",
          priority: "urgent",
        },
      },
      {
        id: "log_skip",
        type: "log",
        name: "Skip Non-Main",
        description: "Log that a non-main branch push was skipped",
        position: { x: 400, y: 350 },
        log: {
          level: "info",
          message: "Skipped deploy for non-main ref: {{trigger.data.ref}}",
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_ref",
        target: "condition_main",
      },
      {
        id: "edge_2",
        source: "action_deploy",
        target: "delay_settle",
      },
      {
        id: "edge_3",
        source: "delay_settle",
        target: "action_health_check",
      },
      {
        id: "edge_4",
        source: "action_health_check",
        target: "condition_healthy",
      },
    ],
    variables: {
      deployUrl: {
        type: "string",
        description: "Deploy API endpoint URL",
      },
      deployToken: {
        type: "string",
        description: "Bearer token for the deploy API",
        sensitive: true,
      },
      healthCheckUrl: {
        type: "string",
        description: "Health check endpoint of the deployed service",
      },
      slackChannel: {
        type: "string",
        default: "#deploys",
        description: "Slack channel for deploy notifications",
      },
    },
    settings: {
      timeout: "120s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "630",
};

/**
 * Cross-Product: Invoice Dunning (Mantle -> Notification escalation chain).
 * Escalating reminder sequence for overdue invoices.
 */
const crossProductInvoiceDunningTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "cross-product-invoice-dunning",
  name: "Invoice Dunning",
  description:
    "Escalating reminder sequence for overdue invoices: reminder, final notice, then escalation.",
  longDescription: `
## Invoice Dunning

Automated escalation chain for overdue invoices from Mantle.

### What it does
1. Listens for \`mantle.invoice.overdue\` events
2. Sends a friendly payment reminder
3. Waits 7 days
4. Sends a final notice
5. Waits 7 more days
6. Escalates to the finance team

### Cross-Product Integration
- **Mantle** (trigger) — invoice lifecycle events
- **Notification** — multi-channel escalation chain

### Setup Required
1. Ensure Mantle emits \`mantle.invoice.overdue\` events
2. Configure email recipients and escalation contacts
3. Adjust delay durations for your dunning cadence

### Customization
- Add a payment link in the notification messages
- Check payment status between delays to cancel the chain
- Add SMS notifications for final escalation
`.trim(),
  category: "billing",
  tags: [
    "mantle",
    "invoice",
    "dunning",
    "billing",
    "cross-product",
    "escalation",
    "notifications",
  ],
  iconUrl: "https://cdn.simpleicons.org/stripe",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_overdue",
        type: "trigger",
        name: "Invoice Overdue",
        description: "Triggered when an invoice becomes overdue in Mantle",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            source: "mantle",
            eventType: "mantle.invoice.overdue",
          },
        },
      },
      {
        id: "notify_reminder",
        type: "notification",
        name: "Payment Reminder",
        description: "Send a friendly payment reminder to the account owner",
        position: { x: 250, y: 200 },
        notification: {
          channel: "email",
          recipients: ["{{trigger.data.ownerEmail}}"],
          title: "Payment Reminder: Invoice #{{trigger.data.invoiceNumber}}",
          message:
            "Hi {{trigger.data.ownerName}}, invoice #{{trigger.data.invoiceNumber}} for {{trigger.data.amount}} is overdue. Please submit payment at your earliest convenience.",
          priority: "normal",
        },
      },
      {
        id: "delay_first",
        type: "delay",
        name: "Wait 7 Days",
        description: "Wait 7 days before sending the final notice",
        position: { x: 250, y: 350 },
        delay: {
          duration: 7,
          unit: "days",
        },
      },
      {
        id: "notify_final",
        type: "notification",
        name: "Final Notice",
        description: "Send a final payment notice",
        position: { x: 250, y: 500 },
        notification: {
          channel: "email",
          recipients: ["{{trigger.data.ownerEmail}}"],
          title:
            "Final Notice: Invoice #{{trigger.data.invoiceNumber}} Overdue",
          message:
            "This is a final reminder that invoice #{{trigger.data.invoiceNumber}} for {{trigger.data.amount}} remains unpaid. Please pay within 7 days to avoid service interruption.",
          priority: "high",
        },
      },
      {
        id: "delay_second",
        type: "delay",
        name: "Wait 7 More Days",
        description: "Wait 7 more days before escalation",
        position: { x: 250, y: 650 },
        delay: {
          duration: 7,
          unit: "days",
        },
      },
      {
        id: "notify_escalation",
        type: "notification",
        name: "Escalate to Finance",
        description: "Escalate the overdue invoice to the finance team",
        position: { x: 250, y: 800 },
        notification: {
          channel: "slack",
          recipients: ["{{variables.financeChannel}}"],
          title:
            "Escalation: Invoice #{{trigger.data.invoiceNumber}} — 14 Days Overdue",
          message:
            "Invoice #{{trigger.data.invoiceNumber}} for {{trigger.data.ownerName}} ({{trigger.data.amount}}) has been overdue for 14 days with no payment. Manual intervention required.",
          priority: "urgent",
          data: {
            invoiceId: "{{trigger.data.invoiceId}}",
            ownerEmail: "{{trigger.data.ownerEmail}}",
            amount: "{{trigger.data.amount}}",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_overdue",
        target: "notify_reminder",
      },
      {
        id: "edge_2",
        source: "notify_reminder",
        target: "delay_first",
      },
      {
        id: "edge_3",
        source: "delay_first",
        target: "notify_final",
      },
      {
        id: "edge_4",
        source: "notify_final",
        target: "delay_second",
      },
      {
        id: "edge_5",
        source: "delay_second",
        target: "notify_escalation",
      },
    ],
    variables: {
      financeChannel: {
        type: "string",
        default: "#finance-escalations",
        description: "Slack channel for finance escalations",
      },
    },
    settings: {
      timeout: "336h",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "640",
};

/**
 * Cross-Product: Monitor Recovery (Heartbeat -> Alert -> Recheck -> Escalate).
 * Alert on monitor downtime, recheck, and escalate if still down.
 */
const crossProductMonitorRecoveryTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "cross-product-monitor-recovery",
  name: "Monitor Recovery",
  description:
    "Alert on service downtime from Heartbeat, recheck after a delay, and escalate if still unhealthy.",
  longDescription: `
## Monitor Recovery

Automated incident response for Heartbeat downtime alerts.

### What it does
1. Listens for \`heartbeat.monitor.down\` events
2. Immediately alerts the on-call team
3. Waits 5 minutes for potential auto-recovery
4. Runs a health check to verify status
5. If still down, escalates to a wider group

### Cross-Product Integration
- **Heartbeat** (trigger) — uptime monitoring events
- **Notification** — multi-tier alerting (initial + escalation)

### Setup Required
1. Ensure Heartbeat emits \`heartbeat.monitor.down\` events
2. Configure the health check URL template
3. Set notification channels for primary and escalation alerts

### Customization
- Adjust the delay before recheck (default 5 min)
- Add an auto-restart action before the recheck
- Chain with PagerDuty or Opsgenie for on-call routing
- Add a second escalation tier for extended outages
`.trim(),
  category: "operations",
  tags: [
    "heartbeat",
    "monitoring",
    "alerting",
    "cross-product",
    "incident",
    "health-check",
    "escalation",
  ],
  iconUrl: "https://cdn.simpleicons.org/uptimekuma",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_monitor_down",
        type: "trigger",
        name: "Monitor Down",
        description: "Triggered when Heartbeat detects a monitor is down",
        position: { x: 250, y: 50 },
        trigger: {
          type: "event",
          config: {
            source: "heartbeat",
            eventType: "heartbeat.monitor.down",
          },
        },
      },
      {
        id: "notify_alert",
        type: "notification",
        name: "Alert On-Call Team",
        description: "Immediately notify the on-call team about the outage",
        position: { x: 250, y: 200 },
        notification: {
          channel: "slack",
          recipients: ["{{variables.alertChannel}}"],
          title: "Monitor Down: {{trigger.data.monitorName}}",
          message:
            "{{trigger.data.monitorName}} ({{trigger.data.url}}) is DOWN as of {{trigger.data.detectedAt}}. Investigating automatically — will escalate if unresolved in 5 minutes.",
          priority: "high",
          data: {
            monitorId: "{{trigger.data.monitorId}}",
            url: "{{trigger.data.url}}",
          },
        },
      },
      {
        id: "delay_recheck",
        type: "delay",
        name: "Wait 5 Minutes",
        description: "Wait 5 minutes for potential auto-recovery",
        position: { x: 250, y: 350 },
        delay: {
          duration: 5,
          unit: "minutes",
        },
      },
      {
        id: "action_health_check",
        type: "action",
        name: "Recheck Health",
        description: "Check if the service has recovered",
        position: { x: 250, y: 500 },
        action: {
          pluginId: "builtin:http",
          operation: "get",
          inputs: {
            url: "{{trigger.data.url}}",
          },
          outputs: {
            status: "recheckStatus",
          },
        },
      },
      {
        id: "condition_recovered",
        type: "condition",
        name: "Recovered?",
        description: "Check if the service is back up",
        position: { x: 250, y: 650 },
        condition: {
          expression: "{{recheckStatus}} == 200",
          trueBranch: "notify_recovered",
          falseBranch: "notify_escalate",
        },
      },
      {
        id: "notify_recovered",
        type: "notification",
        name: "Resolved",
        description: "Notify the team that the service has recovered",
        position: { x: 100, y: 800 },
        notification: {
          channel: "slack",
          recipients: ["{{variables.alertChannel}}"],
          title: "Monitor Recovered: {{trigger.data.monitorName}}",
          message:
            "{{trigger.data.monitorName}} is back UP. Auto-recovery detected after recheck.",
          priority: "normal",
        },
      },
      {
        id: "notify_escalate",
        type: "notification",
        name: "Escalate",
        description: "Escalate to the wider engineering team",
        position: { x: 400, y: 800 },
        notification: {
          channel: "slack",
          recipients: ["{{variables.escalationChannel}}"],
          title: "ESCALATION: {{trigger.data.monitorName}} Still Down",
          message:
            "{{trigger.data.monitorName}} ({{trigger.data.url}}) remains DOWN after 5-minute recheck. Manual intervention required.",
          priority: "urgent",
          data: {
            monitorId: "{{trigger.data.monitorId}}",
            url: "{{trigger.data.url}}",
            downSince: "{{trigger.data.detectedAt}}",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_monitor_down",
        target: "notify_alert",
      },
      {
        id: "edge_2",
        source: "notify_alert",
        target: "delay_recheck",
      },
      {
        id: "edge_3",
        source: "delay_recheck",
        target: "action_health_check",
      },
      {
        id: "edge_4",
        source: "action_health_check",
        target: "condition_recovered",
      },
    ],
    variables: {
      alertChannel: {
        type: "string",
        default: "#on-call",
        description: "Slack channel for initial alerts",
      },
      escalationChannel: {
        type: "string",
        default: "#engineering-escalations",
        description: "Slack channel for escalation alerts",
      },
    },
    settings: {
      timeout: "15m",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "650",
};

/**
 * Public workflow templates seeded for all users.
 */
export const workflowTemplates = [
  discordSendMessageTemplate,
  discordWebhookTemplate,
  discordRichEmbedTemplate,
  discordScheduledNotificationTemplate,
  slackSendMessageTemplate,
  githubCreateIssueTemplate,
  githubPrSlackNotificationTemplate,
  webhookRelayTemplate,
  apiHealthCheckTemplate,
  rssFeedNotificationTemplate,
  aiContentSummarizerTemplate,
  aiSentimentClassifierTemplate,
  webhookAiResponderTemplate,
  deployNotificationTemplate,
];

/**
 * Integration catalog sync workflow template.
 * Syncs the Activepieces integration catalog from npm nightly and opens a PR.
 */
const catalogSyncTemplate: Omit<
  InsertWorkflowTemplate,
  "id" | "createdAt" | "updatedAt"
> = {
  slug: "catalog-sync",
  name: "Integration Catalog Sync",
  description:
    "Sync Activepieces integration catalog from npm and open a PR with changes.",
  longDescription: `
## Integration Catalog Sync

Automatically syncs the Activepieces integration catalog from the npm registry and opens a pull request when changes are detected.

### What it does
1. Fetches the current \`catalog.json\` from the GitHub repository
2. Calls the internal catalog sync endpoint to fetch fresh data from npm
3. Compares the two catalogs for changes
4. If changes are detected, creates/updates a branch and opens a PR

### Schedule
Runs daily at 04:00 UTC. Most runs are no-ops since the npm registry doesn't change frequently.

### Setup Required
1. Configure the Vortex API base URL
2. Set the internal service key for API authentication
3. Connect a GitHub integration with repo write access
4. Set the target repository owner, name, and branch
`.trim(),
  category: "operations",
  tags: ["catalog", "sync", "npm", "integrations", "cron", "operations"],
  iconUrl: "https://cdn.simpleicons.org/npm",
  definition: {
    version: "1.0",
    steps: [
      {
        id: "trigger_cron",
        type: "trigger",
        name: "Daily at 4 AM UTC",
        description: "Sync integration catalog during low-traffic hours",
        position: { x: 250, y: 50 },
        trigger: {
          type: "cron",
          config: {
            expression: "0 4 * * *",
            timezone: "UTC",
          },
        },
      },
      {
        id: "action_fetch_current",
        type: "action",
        name: "Fetch Current Catalog",
        description: "Get current catalog.json from GitHub repo",
        position: { x: 250, y: 200 },
        action: {
          integrationId: "github",
          operation: "get_file_contents",
          inputs: {
            owner: "{{variables.githubOwner}}",
            repo: "{{variables.githubRepo}}",
            path: "src/data/integrations/catalog.json",
            ref: "{{variables.targetBranch}}",
          },
          outputs: {
            content: "currentCatalog",
            sha: "currentCatalogSha",
          },
        },
      },
      {
        id: "action_sync_npm",
        type: "action",
        name: "Sync from npm",
        description: "Fetch fresh catalog from npm registry via internal API",
        position: { x: 250, y: 350 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.apiBaseUrl}}/api/v1/internal/catalog/sync",
            headers: {
              Authorization: "Bearer {{variables.serviceKey}}",
            },
          },
          outputs: {
            status: "syncStatus",
            body: "freshCatalog",
          },
        },
      },
      {
        id: "condition_changed",
        type: "condition",
        name: "Catalog Changed?",
        description: "Compare current and fresh catalog totals",
        position: { x: 250, y: 500 },
        condition: {
          expression:
            "{{freshCatalog.total}} !== {{currentCatalog.total}} || !{{currentCatalog}}",
          branches: {
            true: "action_create_pr",
            false: "action_log_noop",
          },
        },
      },
      {
        id: "action_log_noop",
        type: "action",
        name: "Log No Changes",
        description: "Log that no changes were detected",
        position: { x: 100, y: 650 },
        action: {
          pluginId: "builtin:log",
          operation: "info",
          inputs: {
            message:
              "Catalog sync: no changes detected ({{freshCatalog.total}} entries)",
          },
        },
      },
      {
        id: "action_create_pr",
        type: "action",
        name: "Open/Update PR",
        description: "Create or update the catalog sync branch and open a PR",
        position: { x: 400, y: 650 },
        action: {
          integrationId: "github",
          operation: "create_or_update_pull_request",
          inputs: {
            owner: "{{variables.githubOwner}}",
            repo: "{{variables.githubRepo}}",
            branch: "chore/sync-integration-catalog",
            baseBranch: "{{variables.targetBranch}}",
            title: "chore: sync integration catalog",
            body: "Automated sync of Activepieces integration catalog from npm.\n\nTotal integrations: {{freshCatalog.total}}",
            files: [
              {
                path: "src/data/integrations/catalog.json",
                content: "{{freshCatalog | json}}",
              },
            ],
          },
          outputs: {
            prUrl: "pullRequestUrl",
            prNumber: "pullRequestNumber",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_cron",
        target: "action_fetch_current",
      },
      {
        id: "edge_2",
        source: "action_fetch_current",
        target: "action_sync_npm",
      },
      {
        id: "edge_3",
        source: "action_sync_npm",
        target: "condition_changed",
      },
      {
        id: "edge_4",
        source: "condition_changed",
        target: "action_create_pr",
        label: "changed",
      },
      {
        id: "edge_5",
        source: "condition_changed",
        target: "action_log_noop",
        label: "no change",
      },
    ],
    variables: {
      apiBaseUrl: {
        type: "string",
        description: "Vortex API base URL",
        default: "https://api.vortex.omni.dev",
      },
      serviceKey: {
        type: "string",
        description: "Internal API service key",
        sensitive: true,
      },
      githubOwner: {
        type: "string",
        description: "GitHub repository owner",
        default: "omnidotdev",
      },
      githubRepo: {
        type: "string",
        description: "GitHub repository name",
        default: "vortex-api",
      },
      targetBranch: {
        type: "string",
        description: "PR target branch",
        default: "master",
      },
    },
    settings: {
      timeout: "60s",
    },
  },
  requiredIntegrations: ["github"],
  isPublic: false,
  isFeatured: false,
  sortOrder: "900",
};

/**
 * Omni-internal workflow templates (not seeded publicly).
 * These reference internal Omni services and should only be seeded
 * for the platform org when org-scoped templates are supported.
 * @knipignore Reserved for future org-scoped template support
 */
export const _internalTemplates = [
  authzReconcileTemplate,
  newUserOnboardingTemplate,
  auditDigestTemplate,
  crossProductOnboardingTemplate,
  crossProductSubscriptionChangedTemplate,
  crossProductFeedbackToTaskTemplate,
  crossProductDeployVerifyTemplate,
  crossProductInvoiceDunningTemplate,
  crossProductMonitorRecoveryTemplate,
  catalogSyncTemplate,
];

/**
 * Run this seed to populate the workflow_template table.
 */
export async function seedWorkflowTemplates(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle db instance type varies by driver
  db: any,
) {
  const { workflowTemplateTable } = await import(
    "../schema/workflowTemplate.table"
  );

  // Upsert each template
  for (const template of workflowTemplates) {
    await db
      .insert(workflowTemplateTable)
      .values(template)
      .onConflictDoUpdate({
        target: workflowTemplateTable.slug,
        set: {
          name: template.name,
          description: template.description,
          longDescription: template.longDescription,
          category: template.category,
          tags: template.tags,
          iconUrl: template.iconUrl,
          definition: template.definition,
          requiredIntegrations: template.requiredIntegrations,
          isPublic: template.isPublic,
          isFeatured: template.isFeatured,
          sortOrder: template.sortOrder,
        },
      });
  }

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${workflowTemplates.length} workflow templates`);
}
