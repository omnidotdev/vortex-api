/**
 * OAuth API Routes
 *
 * Provides endpoints for OAuth2 authorization flow:
 * - GET /api/v1/oauth/:provider/authorize - Start authorization
 * - GET /api/v1/oauth/:provider/callback - Handle callback
 * - POST /api/v1/oauth/:provider/disconnect - Disconnect integration
 */

import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { VORTEX_PUBLIC_URL, getOAuthCredentials } from "lib/config/env.config";
import { decrypt } from "lib/crypto/encryption";
import { dbPool as db } from "lib/db/db";
import {
  integrationDefinitionTable,
  integrationTable,
  mcpServerTable,
  oauthTokenTable,
} from "lib/db/schema";
import logger from "lib/logger";
import { getOAuthProvider, isOAuthProviderSupported } from "./providers";
import { createOAuthState, validateOAuthState } from "./state";
import {
  exchangeCodeForTokens,
  getOAuthCallbackUrl,
  revokeToken,
  storeTokens,
} from "./tokens";

/**
 * OAuth API routes.
 */
const oauthRoutes = new Elysia({ prefix: "/api/v1/oauth" })
  /**
   * Start OAuth authorization flow.
   * Redirects to provider's authorization page.
   *
   * GET /api/v1/oauth/:provider/authorize
   */
  .get(
    "/:provider/authorize",
    async ({ params, query, redirect, set }) => {
      const { provider } = params;
      const { organizationId, definitionId, scopes, returnUrl } = query;

      // Validate provider
      if (!isOAuthProviderSupported(provider)) {
        set.status = 400;
        return { error: `Unsupported OAuth provider: ${provider}` };
      }

      // Check if OAuth credentials are configured
      const credentials = getOAuthCredentials(provider);
      if (!credentials) {
        set.status = 503;
        return { error: `OAuth not configured for provider: ${provider}` };
      }

      // Validate definition exists and supports OAuth
      const definition = await db.query.integrationDefinitionTable.findFirst({
        where: eq(integrationDefinitionTable.id, definitionId),
      });

      if (!definition) {
        set.status = 404;
        return { error: "Integration definition not found" };
      }

      if (!definition.supportsOAuth) {
        set.status = 400;
        return { error: "This integration does not support OAuth" };
      }

      // Get provider config
      const providerConfig = getOAuthProvider(provider);
      const redirectUri = getOAuthCallbackUrl(provider);

      // Create OAuth state
      const { state, codeChallenge } = await createOAuthState({
        organizationId,
        provider,
        definitionId,
        scopes: scopes?.split(","),
        redirectUri,
        returnUrl,
      });

      // Build authorization URL
      const authUrl = new URL(providerConfig.authorizationUrl);
      authUrl.searchParams.set("client_id", credentials.clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);

      // Add scopes
      const finalScopes = scopes?.split(",") ?? providerConfig.defaultScopes;
      authUrl.searchParams.set("scope", finalScopes.join(" "));

      // Add PKCE challenge if required
      if (codeChallenge) {
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");
      }

      // Add provider-specific params
      if (providerConfig.authParams) {
        for (const [key, value] of Object.entries(providerConfig.authParams)) {
          authUrl.searchParams.set(key, value);
        }
      }

      // Redirect to provider
      return redirect(authUrl.toString());
    },
    {
      params: t.Object({
        provider: t.String(),
      }),
      query: t.Object({
        organizationId: t.String(),
        definitionId: t.String(),
        scopes: t.Optional(t.String()),
        returnUrl: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Handle OAuth callback from provider.
   * Exchanges code for tokens and creates integration.
   *
   * GET /api/v1/oauth/:provider/callback
   */
  .get(
    "/:provider/callback",
    async ({ params, query, redirect, set: _set }) => {
      const { provider } = params;
      const { code, state, error: oauthError, error_description } = query;

      // Get base URL for redirects
      const appBaseUrl = VORTEX_PUBLIC_URL || "http://localhost:5173";

      // Handle OAuth errors
      if (oauthError) {
        const errorUrl = new URL(`${appBaseUrl}/oauth/error`);
        errorUrl.searchParams.set("error", oauthError);
        if (error_description) {
          errorUrl.searchParams.set("description", error_description);
        }
        return redirect(errorUrl.toString());
      }

      if (!code || !state) {
        const errorUrl = new URL(`${appBaseUrl}/oauth/error`);
        errorUrl.searchParams.set("error", "missing_params");
        errorUrl.searchParams.set(
          "description",
          "Missing code or state parameter",
        );
        return redirect(errorUrl.toString());
      }

      try {
        // Validate state and get stored data
        const stateRecord = await validateOAuthState(state);

        // Verify provider matches
        if (stateRecord.provider !== provider) {
          throw new Error("Provider mismatch");
        }

        // Decrypt code verifier if present
        const codeVerifier = stateRecord.codeVerifier
          ? decrypt(stateRecord.codeVerifier)
          : null;

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(
          provider,
          code,
          codeVerifier,
          stateRecord.redirectUri,
        );

        // Get definition for integration creation
        const definition = await db.query.integrationDefinitionTable.findFirst({
          where: eq(integrationDefinitionTable.id, stateRecord.definitionId),
        });

        if (!definition) {
          throw new Error("Integration definition not found");
        }

        // Create MCP server for the integration
        const [mcpServer] = await db
          .insert(mcpServerTable)
          .values({
            organizationId: stateRecord.organizationId,
            name: definition.name,
            type: definition.id,
            command: definition.mcpCommand,
            args: definition.mcpArgs,
            env: {}, // OAuth tokens are stored separately
            isEnabled: true,
          })
          .returning();

        // Create integration
        const [integration] = await db
          .insert(integrationTable)
          .values({
            organizationId: stateRecord.organizationId,
            definitionId: stateRecord.definitionId,
            mcpServerId: mcpServer.id,
            type: definition.id,
            name: definition.name,
            isEnabled: true,
            config: {},
            authMethod: "oauth",
            oauthStatus: "connected",
            oauthConnectedAt: new Date().toISOString(),
          })
          .returning();

        // Store tokens
        await storeTokens(
          integration.id,
          stateRecord.organizationId,
          provider,
          tokens,
        );

        // Build success redirect URL
        const successUrl = new URL(
          stateRecord.returnUrl || `${appBaseUrl}/integrations`,
        );
        successUrl.searchParams.set("oauth", "success");
        successUrl.searchParams.set("provider", provider);
        successUrl.searchParams.set("integrationId", integration.id);

        return redirect(successUrl.toString());
      } catch (err) {
        logger.error("OAuth callback failed", {
          provider,
          error: err instanceof Error ? err.message : String(err),
        });

        const errorUrl = new URL(`${appBaseUrl}/oauth/error`);
        errorUrl.searchParams.set("error", "callback_failed");
        errorUrl.searchParams.set(
          "description",
          err instanceof Error ? err.message : "OAuth callback failed",
        );
        return redirect(errorUrl.toString());
      }
    },
    {
      params: t.Object({
        provider: t.String(),
      }),
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
        error_description: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Disconnect an OAuth integration.
   * Revokes token and removes integration.
   *
   * POST /api/v1/oauth/:provider/disconnect
   */
  .post(
    "/:provider/disconnect",
    async ({ params: _params, body, set }) => {
      const { integrationId } = body;

      // Verify integration exists
      const integration = await db.query.integrationTable.findFirst({
        where: eq(integrationTable.id, integrationId),
      });

      if (!integration) {
        set.status = 404;
        return { error: "Integration not found" };
      }

      if (integration.authMethod !== "oauth") {
        set.status = 400;
        return { error: "Integration is not using OAuth" };
      }

      // Find and revoke token
      const token = await db.query.oauthTokenTable.findFirst({
        where: eq(oauthTokenTable.integrationId, integrationId),
      });

      if (token) {
        await revokeToken(token.id);
      }

      return { success: true, message: "OAuth disconnected successfully" };
    },
    {
      params: t.Object({
        provider: t.String(),
      }),
      body: t.Object({
        integrationId: t.String(),
      }),
    },
  )

  /**
   * Get OAuth status for an integration.
   *
   * GET /api/v1/oauth/status/:integrationId
   */
  .get(
    "/status/:integrationId",
    async ({ params, set }) => {
      const { integrationId } = params;

      const integration = await db.query.integrationTable.findFirst({
        where: eq(integrationTable.id, integrationId),
      });

      if (!integration) {
        set.status = 404;
        return { error: "Integration not found" };
      }

      const token = await db.query.oauthTokenTable.findFirst({
        where: eq(oauthTokenTable.integrationId, integrationId),
        columns: {
          id: true,
          provider: true,
          scope: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return {
        authMethod: integration.authMethod,
        oauthStatus: integration.oauthStatus,
        oauthConnectedAt: integration.oauthConnectedAt,
        token: token
          ? {
              provider: token.provider,
              scope: token.scope,
              expiresAt: token.expiresAt,
              createdAt: token.createdAt,
            }
          : null,
      };
    },
    {
      params: t.Object({
        integrationId: t.String(),
      }),
    },
  );

export default oauthRoutes;
