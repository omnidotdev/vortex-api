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
  description: "Send a message to a Discord channel via webhook or bot.",
  longDescription: `
## Send Discord Message

This template creates a workflow that sends messages to a Discord channel.

### Use Cases
- Send notifications when events occur
- Post automated updates to team channels
- Create alerts for monitoring systems

### Setup Required
1. Create a Discord Webhook in your channel settings, OR
2. Connect a Discord bot via OAuth in integrations

### Customization
- Modify the trigger to use webhooks, cron, or events
- Add conditions to filter when messages are sent
- Include dynamic data from trigger payload
`.trim(),
  category: "communication",
  tags: ["discord", "messaging", "notifications", "bot", "webhook"],
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
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.webhookUrl}}",
            body: {
              content: "{{trigger.message}}",
              username: "{{variables.botName}}",
              avatar_url: "{{variables.avatarUrl}}",
              embeds: [],
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
          outputs: {
            status: "discordResponseStatus",
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
      webhookUrl: {
        type: "string",
        description: "Discord webhook URL for the channel",
      },
      botName: {
        type: "string",
        default: "Vortex Bot",
        description: "Display name for the bot",
      },
      avatarUrl: {
        type: "string",
        default: "",
        description: "Avatar URL for the bot (optional)",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: [],
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
          pluginId: "builtin:http",
          operation: "post",
          inputs: {
            url: "{{variables.webhookUrl}}",
            body: {
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
                  timestamp: new Date().toISOString(),
                },
              ],
            },
            headers: {
              "Content-Type": "application/json",
            },
          },
          outputs: {
            status: "discordResponseStatus",
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
      webhookUrl: {
        type: "string",
        description: "Discord webhook URL for the channel",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: [],
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
            status: "discordResponseStatus",
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
      webhookUrl: {
        type: "string",
        description: "Discord webhook URL for the channel",
      },
      message: {
        type: "string",
        default:
          "🔔 Good morning team! Time for standup. Please share your updates.",
        description: "Message to send",
      },
      botName: {
        type: "string",
        default: "Reminder Bot",
        description: "Display name for the bot",
      },
    },
    settings: {
      timeout: "30s",
    },
  },
  requiredIntegrations: [],
  isPublic: true,
  isFeatured: true,
  sortOrder: "120",
};

/**
 * All workflow templates to seed.
 */
export const workflowTemplates = [
  discordSendMessageTemplate,
  discordRichEmbedTemplate,
  discordScheduledNotificationTemplate,
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
