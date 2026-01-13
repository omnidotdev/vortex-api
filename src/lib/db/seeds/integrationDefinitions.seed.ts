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
          "Classic token with repo scope (fine-grained tokens not fully supported)",
        placeholder: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
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
    setupSteps: [
      "Go to GitHub Settings → Developer settings → Personal access tokens",
      "Click 'Generate new token (classic)'",
      "Give it a name and select the 'repo' scope",
      "Click 'Generate token' and copy it immediately",
    ],
    docsUrl: "https://github.com/settings/tokens",
    supportsOAuth: true,
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
        description: "The bot token from your Discord application",
        placeholder:
          "MTIzNDU2Nzg5MDEyMzQ1Njc4.XXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        secret: true,
        required: true,
        helpUrl: "https://discord.com/developers/docs/getting-started",
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-discord",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/discord-mcp-server"],
    keepAlive: true, // Discord bots need persistent connections
    idleTimeoutMs: 0, // No timeout when keepAlive is true
    isFeatured: true,
    isEnabled: true,
    setupSteps: [
      "Go to Discord Developer Portal",
      "Click 'New Application' and give it a name",
      "Go to 'Bot' in the sidebar and click 'Add Bot'",
      "Click 'Reset Token' to generate a new token",
      "Copy the token and paste it below",
    ],
    docsUrl: "https://discord.com/developers/applications",
    supportsOAuth: true,
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Connect to Slack for messaging, channel management, and workflow automation.",
    iconUrl: "https://svgl.app/library/slack.svg",
    category: "communication",
    authType: "bearer_token",
    authFields: {
      botToken: {
        type: "string",
        label: "Bot User OAuth Token",
        description: "Starts with xoxb-",
        placeholder: "xoxb-1234567890-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx",
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
    setupSteps: [
      "Go to Slack API portal and click 'Create New App'",
      "Choose 'From scratch' and select your workspace",
      "Go to 'OAuth & Permissions' in the sidebar",
      "Add required Bot Token Scopes (chat:write, channels:read)",
      "Click 'Install to Workspace' and authorize",
      "Copy the 'Bot User OAuth Token' and paste it below",
    ],
    docsUrl: "https://api.slack.com/apps",
    supportsOAuth: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description:
      "Connect to OpenAI for GPT models, DALL-E, embeddings, and more.",
    iconUrl: "https://svgl.app/library/openai.svg",
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
          "Paste the entire contents of your downloaded JSON key file",
        placeholder:
          '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}',
        secret: true,
        required: true,
        helpUrl: "https://cloud.google.com/iam/docs/service-accounts-create",
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/google-sheets-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/google-sheets-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
    setupSteps: [
      "Go to Google Cloud Console → APIs & Services → Credentials",
      "Click 'Create Credentials' → 'Service Account'",
      "Fill in the service account details and click 'Create'",
      "Click on the service account, go to 'Keys' tab",
      "Click 'Add Key' → 'Create new key' → JSON",
      "Download the JSON file and paste its contents below",
    ],
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    supportsOAuth: true,
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
        description: "Your Resend API key",
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
    setupSteps: [
      "Go to Resend Dashboard → API Keys",
      "Click 'Create API Key'",
      "Give it a name and select permissions",
      "Copy the API key (it won't be shown again)",
    ],
    docsUrl: "https://resend.com/api-keys",
    supportsOAuth: false,
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description:
      "Connect to SendGrid for email delivery, templates, and analytics.",
    iconUrl: "https://api.iconify.design/logos/sendgrid-icon.svg",
    category: "email",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your SendGrid API key with Full Access",
        placeholder:
          "SG.xxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
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
    setupSteps: [
      "Go to SendGrid Settings → API Keys",
      "Click 'Create API Key'",
      "Give it a name and select 'Full Access'",
      "Click 'Create & View' and copy the key",
    ],
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
    supportsOAuth: false,
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "Connect to Twilio for SMS, voice calls, and messaging.",
    iconUrl: "https://svgl.app/library/twilio.svg",
    category: "sms",
    authType: "custom",
    authFields: {
      accountSid: {
        type: "string",
        label: "Account SID",
        description: "Your Twilio Account SID (starts with AC)",
        placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: false,
        required: true,
      },
      authToken: {
        type: "string",
        label: "Auth Token",
        description: "Your Twilio Auth Token",
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
    setupSteps: [
      "Go to Twilio Console Dashboard",
      "Find 'Account Info' section on the dashboard",
      "Copy your Account SID and Auth Token",
    ],
    docsUrl: "https://console.twilio.com",
    supportsOAuth: false,
  },
];

/**
 * Run this seed to populate the integration_definition table.
 */
export async function seedIntegrationDefinitions(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle db instance type varies by driver
  db: any,
) {
  const { integrationDefinitionTable } = await import(
    "../schema/integrationDefinition.table"
  );

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
          setupSteps: def.setupSteps,
          docsUrl: def.docsUrl,
          supportsOAuth: def.supportsOAuth,
        },
      });
  }

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(
    `Seeded ${featuredIntegrationDefinitions.length} integration definitions`,
  );
}
