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
          operation: "sendChannelMessage",
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
          operation: "sendChannelMessage",
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
          operation: "sendChannelMessage",
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
    "Send a message to Discord via webhook URL (no bot setup required).",
  longDescription: `
## Discord Webhook Message

Send messages to Discord using a webhook URL - the simplest way to post messages.

### Setup
1. In Discord, right-click a channel → Edit Channel → Integrations → Webhooks
2. Create a webhook and copy the URL
3. Paste the webhook URL in this workflow's variables

### Use Cases
- Quick notifications without bot setup
- CI/CD pipeline alerts
- Monitoring alerts
- Simple integrations
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
        id: "action_send_webhook",
        type: "action",
        name: "Send to Discord Webhook",
        description: "Post a message via Discord webhook",
        position: { x: 250, y: 200 },
        action: {
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.webhookUrl}}",
            body: {
              content: "{{variables.message}}",
              username: "{{variables.botName}}",
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
          outputs: {
            status: "responseStatus",
          },
        },
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "trigger_1",
        target: "action_send_webhook",
      },
    ],
    variables: {
      webhookUrl: {
        type: "string",
        description: "Discord webhook URL (get from channel settings)",
      },
      message: {
        type: "string",
        default: "Hello from Vortex! 🚀",
        description: "Message to send",
      },
      botName: {
        type: "string",
        default: "Vortex Bot",
        description: "Display name for the webhook message",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: [],
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
 * All workflow templates to seed.
 */
export const workflowTemplates = [
  discordSendMessageTemplate,
  discordWebhookTemplate,
  discordRichEmbedTemplate,
  discordScheduledNotificationTemplate,
  authzReconcileTemplate,
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
