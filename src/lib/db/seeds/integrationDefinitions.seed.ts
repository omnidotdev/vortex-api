import type { AuthFields } from "../schema/integrationDefinition.table";

/**
 * Seed data for featured integration definitions.
 * These are the launch essentials - curated integrations with proper configuration.
 */
export const featuredIntegrationDefinitions = [
  {
    id: "github",
    name: "GitHub",
    description:
      "Connect to GitHub for repository management, issues, pull requests, and more.",
    iconUrl: "https://cdn.simpleicons.org/github",
    category: "developer",
    authType: "bearer_token",
    authFields: {
      token: {
        type: "string",
        label: "Personal Access Token",
        description:
          "Generate a token at GitHub Settings > Developer settings > Personal access tokens",
        placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/github-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/github-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "discord",
    name: "Discord",
    description:
      "Connect to Discord for sending messages, managing channels, and bot interactions.",
    iconUrl: "https://cdn.simpleicons.org/discord",
    category: "communication",
    authType: "bearer_token",
    authFields: {
      botToken: {
        type: "string",
        label: "Bot Token",
        description:
          "Get your bot token from the Discord Developer Portal > Your App > Bot",
        placeholder:
          "MTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-discord",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/discord-mcp-server"],
    keepAlive: true, // Discord bots need persistent connections
    idleTimeoutMs: 0, // No timeout when keepAlive is true
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Connect to Slack for messaging, channel management, and workflow automation.",
    iconUrl: "https://cdn.simpleicons.org/slack",
    category: "communication",
    authType: "bearer_token",
    authFields: {
      botToken: {
        type: "string",
        label: "Bot User OAuth Token",
        description:
          "Get your token from Slack App Settings > OAuth & Permissions > Bot User OAuth Token",
        placeholder: "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/slack-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/slack-mcp-server"],
    keepAlive: true, // Slack bots benefit from persistent connections
    idleTimeoutMs: 0,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description:
      "Connect to OpenAI for GPT models, DALL-E, embeddings, and more.",
    iconUrl: "https://cdn.simpleicons.org/openai",
    category: "ai",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Get your API key from platform.openai.com/api-keys",
        placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-openai",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/openai-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Connect to Anthropic for Claude models and AI capabilities.",
    iconUrl: "https://cdn.simpleicons.org/anthropic",
    category: "ai",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description:
          "Get your API key from console.anthropic.com/settings/keys",
        placeholder: "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/claude-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/claude-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Connect to Stripe for payments, subscriptions, and billing management.",
    iconUrl: "https://cdn.simpleicons.org/stripe",
    category: "payments",
    authType: "api_key",
    authFields: {
      secretKey: {
        type: "string",
        label: "Secret Key",
        description:
          "Get your secret key from Stripe Dashboard > Developers > API keys",
        placeholder: "sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-stripe",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/stripe-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    description:
      "Connect to Google Sheets for spreadsheet automation and data management.",
    iconUrl: "https://cdn.simpleicons.org/googlesheets",
    category: "productivity",
    authType: "custom",
    authFields: {
      serviceAccountJson: {
        type: "json",
        label: "Service Account JSON",
        description:
          "Upload your service account JSON from Google Cloud Console > IAM & Admin > Service Accounts",
        placeholder: '{"type": "service_account", ...}',
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/google-sheets-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/google-sheets-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "resend",
    name: "Resend",
    description:
      "Connect to Resend for sending transactional and marketing emails.",
    iconUrl: "https://cdn.simpleicons.org/resend",
    category: "email",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Get your API key from resend.com/api-keys",
        placeholder: "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-resend",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/resend-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description:
      "Connect to SendGrid for email delivery, templates, and analytics.",
    iconUrl: "https://cdn.simpleicons.org/sendgrid",
    category: "email",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Get your API key from SendGrid Settings > API Keys",
        placeholder: "SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-sendgrid",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/sendgrid-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "Connect to Twilio for SMS, voice calls, and messaging.",
    iconUrl: "https://cdn.simpleicons.org/twilio",
    category: "sms",
    authType: "custom",
    authFields: {
      accountSid: {
        type: "string",
        label: "Account SID",
        description: "Find your Account SID in the Twilio Console dashboard",
        placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: false,
        required: true,
      },
      authToken: {
        type: "string",
        label: "Auth Token",
        description: "Find your Auth Token in the Twilio Console dashboard",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-twilio",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/twilio-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
  },
];

/**
 * Run this seed to populate the integration_definition table.
 */
export async function seedIntegrationDefinitions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
) {
  const { integrationDefinitionTable } =
    await import("../schema/integrationDefinition.table");

  // Upsert each definition
  for (const def of featuredIntegrationDefinitions) {
    await db
      .insert(integrationDefinitionTable)
      .values(def)
      .onConflictDoUpdate({
        target: integrationDefinitionTable.id,
        set: {
          name: def.name,
          description: def.description,
          iconUrl: def.iconUrl,
          category: def.category,
          authType: def.authType,
          authFields: def.authFields,
          mcpPackage: def.mcpPackage,
          mcpCommand: def.mcpCommand,
          mcpArgs: def.mcpArgs,
          keepAlive: def.keepAlive,
          idleTimeoutMs: def.idleTimeoutMs,
          isFeatured: def.isFeatured,
          isEnabled: def.isEnabled,
        },
      });
  }

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(
    `Seeded ${featuredIntegrationDefinitions.length} integration definitions`,
  );
}
