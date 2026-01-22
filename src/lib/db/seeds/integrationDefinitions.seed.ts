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
    authType: "oauth2",
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
    authType: "oauth2",
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
    authType: "oauth2",
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
      "Choose 'From scratch' and select your organization",
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
    id: "google",
    name: "Google Sheets",
    description:
      "Connect to Google Sheets for spreadsheet automation and data management.",
    iconUrl: "https://cdn.simpleicons.org/googlesheets",
    category: "productivity",
    authType: "oauth2",
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
  // --- Additional Integrations ---
  {
    id: "notion",
    name: "Notion",
    description:
      "Connect to Notion for workspace automation, database management, and content sync.",
    iconUrl: "https://cdn.simpleicons.org/notion",
    category: "productivity",
    authType: "oauth2",
    authFields: {
      apiKey: {
        type: "string",
        label: "Internal Integration Token",
        description: "Your Notion internal integration token",
        placeholder: "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/notion-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/notion-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
    setupSteps: [
      "Go to notion.so/my-integrations",
      "Click 'New integration'",
      "Give it a name and select your workspace",
      "Copy the 'Internal Integration Token'",
      "Share the pages/databases you want to access with the integration",
    ],
    docsUrl: "https://www.notion.so/my-integrations",
    supportsOAuth: true,
  },
  {
    id: "airtable",
    name: "Airtable",
    description:
      "Connect to Airtable for database operations, automations, and data sync.",
    iconUrl: "https://cdn.simpleicons.org/airtable",
    category: "productivity",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "Personal Access Token",
        description: "Your Airtable personal access token",
        placeholder: "patxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-airtable",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/airtable-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
    setupSteps: [
      "Go to airtable.com/create/tokens",
      "Click 'Create new token'",
      "Give it a name and select scopes (data.records:read, data.records:write)",
      "Select the bases you want to access",
      "Copy the token",
    ],
    docsUrl: "https://airtable.com/create/tokens",
    supportsOAuth: false,
  },
  {
    id: "linear",
    name: "Linear",
    description:
      "Connect to Linear for issue tracking, project management, and team workflows.",
    iconUrl: "https://cdn.simpleicons.org/linear",
    category: "productivity",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your Linear personal API key",
        placeholder: "lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-linear",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/linear-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
    setupSteps: [
      "Go to Linear Settings → API",
      "Click 'Create key' under Personal API keys",
      "Give it a label and copy the key",
    ],
    docsUrl: "https://linear.app/settings/api",
    supportsOAuth: true,
  },
  {
    id: "jira",
    name: "Jira",
    description:
      "Connect to Jira for issue tracking, sprint management, and project automation.",
    iconUrl: "https://cdn.simpleicons.org/jira",
    category: "productivity",
    authType: "api_key",
    authFields: {
      email: {
        type: "string",
        label: "Email",
        description: "Your Atlassian account email",
        placeholder: "you@example.com",
        secret: false,
        required: true,
      },
      apiToken: {
        type: "string",
        label: "API Token",
        description: "Your Atlassian API token",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
      domain: {
        type: "string",
        label: "Jira Domain",
        description: "Your Jira cloud domain (e.g., yourcompany.atlassian.net)",
        placeholder: "yourcompany.atlassian.net",
        secret: false,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-jira-cloud",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/jira-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to id.atlassian.com/manage-profile/security/api-tokens",
      "Click 'Create API token'",
      "Give it a label and copy the token",
    ],
    docsUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    supportsOAuth: true,
  },
  {
    id: "asana",
    name: "Asana",
    description:
      "Connect to Asana for task management, project tracking, and team collaboration.",
    iconUrl: "https://cdn.simpleicons.org/asana",
    category: "productivity",
    authType: "api_key",
    authFields: {
      accessToken: {
        type: "string",
        label: "Personal Access Token",
        description: "Your Asana personal access token",
        placeholder: "1/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-asana",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/asana-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Asana Developer Console",
      "Click 'Create new token'",
      "Give it a name and copy the token",
    ],
    docsUrl: "https://app.asana.com/0/developer-console",
    supportsOAuth: true,
  },
  {
    id: "trello",
    name: "Trello",
    description:
      "Connect to Trello for board management, card automation, and team workflows.",
    iconUrl: "https://cdn.simpleicons.org/trello",
    category: "productivity",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your Trello API key",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: false,
        required: true,
      },
      token: {
        type: "string",
        label: "Token",
        description: "Your Trello token",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-trello",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/trello-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to trello.com/power-ups/admin/",
      "Click 'New' to create a new Power-Up",
      "Copy your API Key",
      "Click the 'Token' link to generate a token",
    ],
    docsUrl: "https://trello.com/power-ups/admin/",
    supportsOAuth: false,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description:
      "Connect to HubSpot for CRM, marketing automation, and sales pipelines.",
    iconUrl: "https://cdn.simpleicons.org/hubspot",
    category: "productivity",
    authType: "oauth2",
    authFields: {
      accessToken: {
        type: "string",
        label: "Private App Access Token",
        description: "Your HubSpot private app access token",
        placeholder: "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-hubspot",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/hubspot-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: true,
    isEnabled: true,
    setupSteps: [
      "Go to HubSpot Settings → Integrations → Private Apps",
      "Click 'Create a private app'",
      "Give it a name and select scopes",
      "Click 'Create app' and copy the access token",
    ],
    docsUrl: "https://developers.hubspot.com/docs/api/private-apps",
    supportsOAuth: true,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description:
      "Connect to Salesforce for CRM automation, lead management, and sales workflows.",
    iconUrl: "https://cdn.simpleicons.org/salesforce",
    category: "productivity",
    authType: "oauth2",
    authFields: {
      instanceUrl: {
        type: "string",
        label: "Instance URL",
        description: "Your Salesforce instance URL",
        placeholder: "https://yourcompany.salesforce.com",
        secret: false,
        required: true,
      },
      accessToken: {
        type: "string",
        label: "Access Token",
        description: "Your Salesforce access token",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-salesforce",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/salesforce-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Salesforce Setup → Apps → App Manager",
      "Create a new Connected App",
      "Enable OAuth and set callback URL",
      "Copy the Consumer Key and Secret",
    ],
    docsUrl:
      "https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm",
    supportsOAuth: true,
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description:
      "Connect to Mailchimp for email marketing, audience management, and campaigns.",
    iconUrl: "https://cdn.simpleicons.org/mailchimp",
    category: "email",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your Mailchimp API key",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-mailchimp",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/mailchimp-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Mailchimp Account → Extras → API keys",
      "Click 'Create A Key'",
      "Copy the API key (includes datacenter suffix)",
    ],
    docsUrl: "https://mailchimp.com/developer/marketing/guides/quick-start/",
    supportsOAuth: true,
  },
  {
    id: "telegram",
    name: "Telegram",
    description:
      "Connect to Telegram for bot messaging, channel management, and notifications.",
    iconUrl: "https://cdn.simpleicons.org/telegram",
    category: "communication",
    authType: "api_key",
    authFields: {
      botToken: {
        type: "string",
        label: "Bot Token",
        description: "Your Telegram bot token from BotFather",
        placeholder: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-telegram-bot",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/telegram-mcp-server"],
    keepAlive: true,
    idleTimeoutMs: 0,
    isFeatured: true,
    isEnabled: true,
    setupSteps: [
      "Open Telegram and search for @BotFather",
      "Send /newbot and follow the prompts",
      "Copy the bot token provided",
    ],
    docsUrl: "https://core.telegram.org/bots#how-do-i-create-a-bot",
    supportsOAuth: false,
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    description:
      "Connect to Microsoft Teams for messaging, meetings, and team collaboration.",
    iconUrl: "https://cdn.simpleicons.org/microsoftteams",
    category: "communication",
    authType: "oauth2",
    authFields: {
      clientId: {
        type: "string",
        label: "Client ID",
        description: "Your Azure AD application client ID",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: false,
        required: true,
      },
      clientSecret: {
        type: "string",
        label: "Client Secret",
        description: "Your Azure AD application client secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
      tenantId: {
        type: "string",
        label: "Tenant ID",
        description: "Your Azure AD tenant ID",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: false,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-microsoft-teams",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/teams-mcp-server"],
    keepAlive: true,
    idleTimeoutMs: 0,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Azure Portal → Azure Active Directory → App registrations",
      "Click 'New registration'",
      "Set redirect URI and configure API permissions",
      "Create a client secret in 'Certificates & secrets'",
    ],
    docsUrl: "https://docs.microsoft.com/en-us/graph/auth-register-app-v2",
    supportsOAuth: true,
  },
  {
    id: "zoom",
    name: "Zoom",
    description:
      "Connect to Zoom for meeting management, webinars, and video conferencing.",
    iconUrl: "https://cdn.simpleicons.org/zoom",
    category: "communication",
    authType: "oauth2",
    authFields: {
      accountId: {
        type: "string",
        label: "Account ID",
        description: "Your Zoom account ID",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
        secret: false,
        required: true,
      },
      clientId: {
        type: "string",
        label: "Client ID",
        description: "Your Zoom OAuth app client ID",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
        secret: false,
        required: true,
      },
      clientSecret: {
        type: "string",
        label: "Client Secret",
        description: "Your Zoom OAuth app client secret",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-zoom",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/zoom-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Zoom App Marketplace → Develop → Build App",
      "Choose 'Server-to-Server OAuth' app type",
      "Configure scopes and copy credentials",
    ],
    docsUrl: "https://marketplace.zoom.us/develop/create",
    supportsOAuth: true,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description:
      "Connect to Dropbox for file storage, sync, and collaboration.",
    iconUrl: "https://cdn.simpleicons.org/dropbox",
    category: "productivity",
    authType: "oauth2",
    authFields: {
      accessToken: {
        type: "string",
        label: "Access Token",
        description: "Your Dropbox access token",
        placeholder: "sl.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-dropbox",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/dropbox-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Dropbox App Console",
      "Create a new app with 'Full Dropbox' access",
      "Generate an access token in the Settings tab",
    ],
    docsUrl: "https://www.dropbox.com/developers/apps",
    supportsOAuth: true,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description:
      "Connect to Google Drive for file management, sharing, and storage automation.",
    iconUrl: "https://cdn.simpleicons.org/googledrive",
    category: "productivity",
    authType: "oauth2",
    authFields: {
      serviceAccountJson: {
        type: "json",
        label: "Service Account JSON",
        description: "Paste your Google Cloud service account JSON",
        placeholder:
          '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}',
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/google-drive-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/google-drive-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Google Cloud Console → APIs & Services",
      "Enable the Google Drive API",
      "Create a service account and download JSON key",
    ],
    docsUrl:
      "https://console.cloud.google.com/apis/library/drive.googleapis.com",
    supportsOAuth: true,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description:
      "Connect to Google Calendar for event management and scheduling automation.",
    iconUrl: "https://cdn.simpleicons.org/googlecalendar",
    category: "productivity",
    authType: "oauth2",
    authFields: {
      serviceAccountJson: {
        type: "json",
        label: "Service Account JSON",
        description: "Paste your Google Cloud service account JSON",
        placeholder:
          '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}',
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/google-calendar-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/google-calendar-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Google Cloud Console → APIs & Services",
      "Enable the Google Calendar API",
      "Create a service account and download JSON key",
      "Share calendars with the service account email",
    ],
    docsUrl:
      "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
    supportsOAuth: true,
  },
  {
    id: "shopify",
    name: "Shopify",
    description:
      "Connect to Shopify for e-commerce automation, orders, and inventory management.",
    iconUrl: "https://cdn.simpleicons.org/shopify",
    category: "productivity",
    authType: "api_key",
    authFields: {
      shopDomain: {
        type: "string",
        label: "Shop Domain",
        description: "Your Shopify store domain",
        placeholder: "your-store.myshopify.com",
        secret: false,
        required: true,
      },
      accessToken: {
        type: "string",
        label: "Admin API Access Token",
        description: "Your Shopify Admin API access token",
        placeholder: "shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-shopify",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/shopify-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Shopify Admin → Settings → Apps and sales channels",
      "Click 'Develop apps' and create a new app",
      "Configure Admin API scopes",
      "Install the app and copy the Admin API access token",
    ],
    docsUrl: "https://shopify.dev/docs/apps/auth/admin-app-access-tokens",
    supportsOAuth: true,
  },
  {
    id: "wordpress",
    name: "WordPress",
    description:
      "Connect to WordPress for content management, posts, and site automation.",
    iconUrl: "https://cdn.simpleicons.org/wordpress",
    category: "productivity",
    authType: "api_key",
    authFields: {
      siteUrl: {
        type: "string",
        label: "Site URL",
        description: "Your WordPress site URL",
        placeholder: "https://yoursite.com",
        secret: false,
        required: true,
      },
      username: {
        type: "string",
        label: "Username",
        description: "Your WordPress username",
        placeholder: "admin",
        secret: false,
        required: true,
      },
      applicationPassword: {
        type: "string",
        label: "Application Password",
        description: "Your WordPress application password",
        placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-wordpress",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/wordpress-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to WordPress Admin → Users → Profile",
      "Scroll to 'Application Passwords'",
      "Enter a name and click 'Add New Application Password'",
      "Copy the generated password",
    ],
    docsUrl:
      "https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/",
    supportsOAuth: false,
  },
  {
    id: "firebase",
    name: "Firebase",
    description: "Connect to Firebase for database, auth, and cloud functions.",
    iconUrl: "https://cdn.simpleicons.org/firebase",
    category: "developer",
    authType: "api_key",
    authFields: {
      serviceAccountJson: {
        type: "json",
        label: "Service Account JSON",
        description: "Paste your Firebase service account JSON",
        placeholder:
          '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}',
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-firebase",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/firebase-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Firebase Console → Project Settings → Service accounts",
      "Click 'Generate new private key'",
      "Download and paste the JSON contents",
    ],
    docsUrl: "https://firebase.google.com/docs/admin/setup",
    supportsOAuth: false,
  },
  {
    id: "supabase",
    name: "Supabase",
    description:
      "Connect to Supabase for database, auth, and real-time subscriptions.",
    iconUrl: "https://cdn.simpleicons.org/supabase",
    category: "developer",
    authType: "api_key",
    authFields: {
      projectUrl: {
        type: "string",
        label: "Project URL",
        description: "Your Supabase project URL",
        placeholder: "https://xxxxxxxxxxxxx.supabase.co",
        secret: false,
        required: true,
      },
      serviceRoleKey: {
        type: "string",
        label: "Service Role Key",
        description: "Your Supabase service role key (NOT anon key)",
        placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-supabase",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/supabase-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Supabase Dashboard → Settings → API",
      "Copy the Project URL",
      "Copy the service_role key (under 'Project API keys')",
    ],
    docsUrl: "https://supabase.com/docs/guides/api",
    supportsOAuth: false,
  },
  {
    id: "aws-s3",
    name: "AWS S3",
    description:
      "Connect to AWS S3 for file storage, uploads, and bucket management.",
    iconUrl: "https://cdn.simpleicons.org/amazons3",
    category: "developer",
    authType: "api_key",
    authFields: {
      accessKeyId: {
        type: "string",
        label: "Access Key ID",
        description: "Your AWS access key ID",
        placeholder: "AKIAXXXXXXXXXXXXXXXX",
        secret: false,
        required: true,
      },
      secretAccessKey: {
        type: "string",
        label: "Secret Access Key",
        description: "Your AWS secret access key",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
      region: {
        type: "string",
        label: "Region",
        description: "AWS region (e.g., us-east-1)",
        placeholder: "us-east-1",
        secret: false,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-aws-s3",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/aws-s3-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to AWS IAM Console → Users → Create user",
      "Attach S3 permissions policy",
      "Go to Security credentials → Create access key",
      "Copy the Access Key ID and Secret Access Key",
    ],
    docsUrl:
      "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
    supportsOAuth: false,
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description:
      "Connect to MongoDB for database operations and document management.",
    iconUrl: "https://cdn.simpleicons.org/mongodb",
    category: "developer",
    authType: "api_key",
    authFields: {
      connectionString: {
        type: "string",
        label: "Connection String",
        description: "Your MongoDB connection string",
        placeholder:
          "mongodb+srv://user:password@cluster.xxxxx.mongodb.net/dbname",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-mongodb",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/mongodb-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to MongoDB Atlas → Database → Connect",
      "Choose 'Connect your application'",
      "Copy the connection string",
      "Replace <password> with your database user password",
    ],
    docsUrl: "https://www.mongodb.com/docs/atlas/driver-connection/",
    supportsOAuth: false,
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "Connect to PostgreSQL for database queries and management.",
    iconUrl: "https://cdn.simpleicons.org/postgresql",
    category: "developer",
    authType: "api_key",
    authFields: {
      connectionString: {
        type: "string",
        label: "Connection String",
        description: "Your PostgreSQL connection string",
        placeholder: "postgresql://user:password@host:5432/database",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@anthropic/postgres-mcp-server",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/postgres-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Get your PostgreSQL connection details",
      "Format: postgresql://user:password@host:port/database",
      "Ensure the database is accessible from the network",
    ],
    docsUrl:
      "https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING",
    supportsOAuth: false,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description:
      "Connect to Mistral AI for language models and AI capabilities.",
    iconUrl: "https://cdn.simpleicons.org/mistral",
    category: "ai",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your Mistral AI API key",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-mistral",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/mistral-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to console.mistral.ai",
      "Navigate to API Keys section",
      "Create a new API key and copy it",
    ],
    docsUrl: "https://console.mistral.ai/api-keys/",
    supportsOAuth: false,
  },
  {
    id: "groq",
    name: "Groq",
    description: "Connect to Groq for ultra-fast LLM inference.",
    iconUrl: "https://cdn.simpleicons.org/groq",
    category: "ai",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your Groq API key",
        placeholder: "gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-groq",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/groq-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to console.groq.com",
      "Navigate to API Keys",
      "Create a new API key and copy it",
    ],
    docsUrl: "https://console.groq.com/keys",
    supportsOAuth: false,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    description: "Connect to Perplexity for AI-powered search and research.",
    iconUrl: "https://cdn.simpleicons.org/perplexity",
    category: "ai",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your Perplexity API key",
        placeholder: "pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-perplexity",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/perplexity-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to perplexity.ai/settings/api",
      "Generate an API key",
      "Copy the key",
    ],
    docsUrl: "https://docs.perplexity.ai/",
    supportsOAuth: false,
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "Connect to Replicate for running ML models in the cloud.",
    iconUrl: "https://cdn.simpleicons.org/replicate",
    category: "ai",
    authType: "api_key",
    authFields: {
      apiToken: {
        type: "string",
        label: "API Token",
        description: "Your Replicate API token",
        placeholder: "r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-replicate",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/replicate-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to replicate.com/account/api-tokens",
      "Create a new API token",
      "Copy the token",
    ],
    docsUrl: "https://replicate.com/docs/get-started/api-tokens",
    supportsOAuth: false,
  },
  {
    id: "sentry",
    name: "Sentry",
    description:
      "Connect to Sentry for error tracking and performance monitoring.",
    iconUrl: "https://cdn.simpleicons.org/sentry",
    category: "developer",
    authType: "api_key",
    authFields: {
      authToken: {
        type: "string",
        label: "Auth Token",
        description: "Your Sentry auth token",
        placeholder: "sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
      organization: {
        type: "string",
        label: "Organization Slug",
        description: "Your Sentry organization slug",
        placeholder: "your-org",
        secret: false,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-sentry",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/sentry-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Sentry Settings → Auth Tokens",
      "Create a new auth token with required scopes",
      "Copy the token",
    ],
    docsUrl: "https://docs.sentry.io/api/auth/",
    supportsOAuth: false,
  },
  {
    id: "datadog",
    name: "Datadog",
    description:
      "Connect to Datadog for monitoring, logging, and observability.",
    iconUrl: "https://cdn.simpleicons.org/datadog",
    category: "developer",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your Datadog API key",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
      applicationKey: {
        type: "string",
        label: "Application Key",
        description: "Your Datadog application key",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
      site: {
        type: "string",
        label: "Site",
        description: "Your Datadog site (e.g., datadoghq.com, datadoghq.eu)",
        placeholder: "datadoghq.com",
        secret: false,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-datadog",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/datadog-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Datadog → Organization Settings → API Keys",
      "Create a new API key",
      "Go to Application Keys and create one",
    ],
    docsUrl: "https://docs.datadoghq.com/account_management/api-app-keys/",
    supportsOAuth: false,
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    description:
      "Connect to PagerDuty for incident management and on-call scheduling.",
    iconUrl: "https://cdn.simpleicons.org/pagerduty",
    category: "developer",
    authType: "api_key",
    authFields: {
      apiKey: {
        type: "string",
        label: "API Key",
        description: "Your PagerDuty API key",
        placeholder: "u+xxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-pagerduty",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/pagerduty-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to PagerDuty → Integrations → API Access Keys",
      "Create a new API Key",
      "Copy the key",
    ],
    docsUrl: "https://support.pagerduty.com/docs/api-access-keys",
    supportsOAuth: false,
  },
  {
    id: "clickup",
    name: "ClickUp",
    description:
      "Connect to ClickUp for task management and project collaboration.",
    iconUrl: "https://cdn.simpleicons.org/clickup",
    category: "productivity",
    authType: "api_key",
    authFields: {
      apiToken: {
        type: "string",
        label: "API Token",
        description: "Your ClickUp personal API token",
        placeholder: "pk_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-clickup",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/clickup-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to ClickUp Settings → Apps",
      "Click 'Generate' under API Token",
      "Copy the token",
    ],
    docsUrl: "https://clickup.com/api/developer-portal/authentication/",
    supportsOAuth: true,
  },
  {
    id: "monday",
    name: "Monday.com",
    description:
      "Connect to Monday.com for work management and team collaboration.",
    iconUrl: "https://cdn.simpleicons.org/monday",
    category: "productivity",
    authType: "api_key",
    authFields: {
      apiToken: {
        type: "string",
        label: "API Token",
        description: "Your Monday.com API token",
        placeholder: "eyJhbGciOiJIUzI1NiJ9...",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-monday",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/monday-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Monday.com → Avatar → Developers",
      "Click 'My Access Tokens'",
      "Generate a new token and copy it",
    ],
    docsUrl: "https://developer.monday.com/api-reference/docs/authentication",
    supportsOAuth: true,
  },
  {
    id: "zendesk",
    name: "Zendesk",
    description:
      "Connect to Zendesk for customer support and ticketing automation.",
    iconUrl: "https://cdn.simpleicons.org/zendesk",
    category: "communication",
    authType: "api_key",
    authFields: {
      subdomain: {
        type: "string",
        label: "Subdomain",
        description: "Your Zendesk subdomain",
        placeholder: "yourcompany",
        secret: false,
        required: true,
      },
      email: {
        type: "string",
        label: "Email",
        description: "Your Zendesk account email",
        placeholder: "you@example.com",
        secret: false,
        required: true,
      },
      apiToken: {
        type: "string",
        label: "API Token",
        description: "Your Zendesk API token",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-zendesk",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/zendesk-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Zendesk Admin → Apps and Integrations → APIs",
      "Enable Token Access",
      "Add a new API token",
    ],
    docsUrl:
      "https://developer.zendesk.com/api-reference/introduction/security-and-auth/",
    supportsOAuth: true,
  },
  {
    id: "intercom",
    name: "Intercom",
    description: "Connect to Intercom for customer messaging and support.",
    iconUrl: "https://cdn.simpleicons.org/intercom",
    category: "communication",
    authType: "api_key",
    authFields: {
      accessToken: {
        type: "string",
        label: "Access Token",
        description: "Your Intercom access token",
        placeholder: "dG9rOmxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        secret: true,
        required: true,
      },
    } satisfies AuthFields,
    mcpPackage: "@activepieces/piece-intercom",
    mcpCommand: "npx",
    mcpArgs: ["-y", "@anthropic/intercom-mcp-server"],
    keepAlive: false,
    idleTimeoutMs: 300000,
    isFeatured: false,
    isEnabled: true,
    setupSteps: [
      "Go to Intercom Developer Hub",
      "Create a new app or select existing",
      "Go to Authentication and create an access token",
    ],
    docsUrl:
      "https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/",
    supportsOAuth: true,
  },
];

/**
 * Catalog entry from generated catalog.json.
 */
interface CatalogEntry {
  id: string;
  packageId: string;
  displayName: string;
  description: string;
  logoUrl: string;
  authors: string[];
  categories: string[];
  auth?: {
    type: "secret_text" | "basic_auth" | "oauth2" | "custom_auth" | "none";
    displayName: string;
    description?: string;
    fields?: Array<{
      name: string;
      displayName: string;
      description?: string;
      type: "string" | "password" | "url";
      required: boolean;
    }>;
  };
}

interface Catalog {
  generatedAt: string;
  total: number;
  entries: CatalogEntry[];
}

/**
 * Map Activepieces category to our category scheme.
 */
function mapCategory(categories: string[]): string {
  const cat = categories[0]?.toLowerCase() ?? "";
  if (cat.includes("communication")) return "communication";
  if (cat.includes("artificial_intelligence") || cat.includes("ai"))
    return "ai";
  if (cat.includes("developer") || cat.includes("core")) return "developer";
  if (cat.includes("productivity")) return "productivity";
  if (cat.includes("marketing") || cat.includes("sales")) return "marketing";
  if (cat.includes("payment") || cat.includes("accounting")) return "payments";
  if (cat.includes("content") || cat.includes("files")) return "storage";
  if (cat.includes("commerce")) return "commerce";
  if (cat.includes("customer_support")) return "support";
  if (cat.includes("human_resources")) return "hr";
  return "other";
}

/**
 * Map Activepieces auth type to our auth type.
 */
function mapAuthType(
  authType?: string,
): "api_key" | "oauth2" | "custom" | "none" {
  switch (authType) {
    case "secret_text":
      return "api_key";
    case "oauth2":
      return "oauth2";
    case "basic_auth":
    case "custom_auth":
      return "custom";
    default:
      return "none";
  }
}

/**
 * Convert catalog auth fields to our AuthFields format.
 */
function convertAuthFields(
  entry: CatalogEntry,
): Record<string, AuthFieldSchema> {
  if (!entry.auth) return {};

  // For simple auth types, create a default field
  if (entry.auth.type === "secret_text") {
    return {
      apiKey: {
        type: "string",
        label: entry.auth.displayName ?? "API Key",
        description: entry.auth.description,
        secret: true,
        required: true,
      },
    };
  }

  // For custom auth with fields
  if (entry.auth.fields && entry.auth.fields.length > 0) {
    const fields: Record<string, AuthFieldSchema> = {};
    for (const field of entry.auth.fields) {
      fields[field.name] = {
        type: field.type === "password" ? "string" : "string",
        label: field.displayName,
        description: field.description,
        secret: field.type === "password",
        required: field.required,
      };
    }
    return fields;
  }

  return {};
}

interface AuthFieldSchema {
  type: "string" | "text" | "json";
  label: string;
  description?: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  helpUrl?: string;
}

// Max age before warning (7 days)
const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Load catalog from generated JSON file.
 * Warns if catalog is stale.
 */
async function loadCatalog(): Promise<CatalogEntry[]> {
  try {
    const catalogPath = new URL(
      "../../../data/integrations/catalog.json",
      import.meta.url,
    );
    const file = Bun.file(catalogPath);
    const catalog = (await file.json()) as Catalog;

    // Check freshness
    const generatedAt = new Date(catalog.generatedAt);
    const ageMs = Date.now() - generatedAt.getTime();
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    if (ageMs > CATALOG_MAX_AGE_MS) {
      console.warn(
        `\n⚠️  Catalog is ${ageDays} days old. Consider regenerating:`,
      );
      console.warn("   cd ../vortex-worker && bun catalog:generate\n");
    }

    return catalog.entries;
  } catch (error) {
    console.warn(
      "Failed to load catalog.json, skipping auto-discovery:",
      error,
    );
    console.warn("To generate: cd ../vortex-worker && bun catalog:generate\n");
    return [];
  }
}

/**
 * Run this seed to populate the integration_definition table.
 * Combines featured (curated) integrations with auto-discovered catalog.
 */
export async function seedIntegrationDefinitions(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle db instance type varies by driver
  db: any,
) {
  const { integrationDefinitionTable } = await import(
    "../schema/integrationDefinition.table"
  );

  // Create a map of featured IDs for quick lookup
  const featuredIds = new Set(featuredIntegrationDefinitions.map((d) => d.id));

  // Upsert featured definitions first (they have curated metadata)
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
    `Seeded ${featuredIntegrationDefinitions.length} featured integrations`,
  );

  // Load auto-discovered catalog
  const catalogEntries = await loadCatalog();

  // Seed catalog entries that aren't already featured
  let catalogCount = 0;
  for (const entry of catalogEntries) {
    // Skip if already in featured (featured has curated metadata)
    if (featuredIds.has(entry.id)) continue;

    const def = {
      id: entry.id,
      name: entry.displayName,
      description: entry.description,
      iconUrl: entry.logoUrl,
      category: mapCategory(entry.categories),
      authType: mapAuthType(entry.auth?.type),
      authFields: convertAuthFields(entry),
      mcpPackage: entry.packageId,
      mcpCommand: "npx",
      mcpArgs: ["-y", entry.packageId],
      keepAlive: false,
      idleTimeoutMs: 300000,
      isFeatured: false,
      isEnabled: true,
      setupSteps: [],
      supportsOAuth: entry.auth?.type === "oauth2",
    };

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
          supportsOAuth: def.supportsOAuth,
        },
      });

    catalogCount++;
  }

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${catalogCount} catalog integrations`);
  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(
    `Total: ${featuredIntegrationDefinitions.length + catalogCount} integration definitions`,
  );
}
