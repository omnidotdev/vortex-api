/**
 * OAuth API Routes
 *
 * Provides endpoints for OAuth2 authorization flow:
 * - GET /api/v1/oauth/:provider/authorize - Start authorization (redirects)
 * - POST /api/v1/oauth/:provider/authorize-url - Start authorization (returns the provider URL)
 * - GET /api/v1/oauth/:provider/callback - Handle callback
 * - POST /api/v1/oauth/:provider/disconnect - Disconnect integration
 */

import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import resolveAuth from "lib/auth/resolveAuth";
import { VORTEX_PUBLIC_URL } from "lib/config/env.config";
import { decrypt } from "lib/crypto/encryption";
import { dbPool as db } from "lib/db/db";
import {
  integrationDefinitionTable,
  integrationTable,
  oauthTokenTable,
} from "lib/db/schema";
import logger from "lib/logger";
import { prepareAuthorizationUrl } from "./authorizationUrl";
import { isIntegrationConnectAllowed } from "./connectLimit";
import { validateOAuthState } from "./state";
import { exchangeCodeForTokens, revokeToken, storeTokens } from "./tokens";

/** Fields both authorization entry points accept */
const authorizationInput = t.Object({
  organizationId: t.String(),
  definitionId: t.String(),
  scopes: t.Optional(t.String()),
  returnUrl: t.Optional(t.String()),
});

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
    async ({ params, query, headers, redirect, set }) => {
      const result = await prepareAuthorizationUrl({
        authorization: headers.authorization,
        provider: params.provider,
        ...query,
      });

      if (!result.ok) {
        set.status = result.status;
        return { error: result.error };
      }

      // Redirect to provider
      return redirect(result.url);
    },
    {
      params: t.Object({
        provider: t.String(),
      }),
      query: authorizationInput,
    },
  )

  /**
   * Build the provider authorization URL without redirecting.
   *
   * Browsers cannot attach an Authorization header to a top-level navigation,
   * so the app calls this with its session, then navigates to the returned
   * provider URL itself. The caller's credentials stay in the header and never
   * appear in a URL
   *
   * POST /api/v1/oauth/:provider/authorize-url
   */
  .post(
    "/:provider/authorize-url",
    async ({ params, body, headers, set }) => {
      const result = await prepareAuthorizationUrl({
        authorization: headers.authorization,
        provider: params.provider,
        ...body,
      });

      if (!result.ok) {
        set.status = result.status;
        return { error: result.error };
      }

      return { url: result.url };
    },
    {
      params: t.Object({
        provider: t.String(),
      }),
      body: authorizationInput,
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

        // Re-check the connected-accounts limit, since other integrations may
        // have been added while the user was on the provider's consent screen
        const connectLimit = await isIntegrationConnectAllowed(
          stateRecord.organizationId,
        );
        if (!connectLimit.allowed) {
          const limitUrl = new URL(`${appBaseUrl}/oauth/error`);
          limitUrl.searchParams.set("error", "plan_limit");
          limitUrl.searchParams.set(
            "description",
            "Your plan's connected-account limit has been reached. Upgrade your plan to connect more integrations.",
          );
          return redirect(limitUrl.toString());
        }

        // Create integration. No MCP server is created for it: OAuth
        // integrations run through the built-in connectors, and exposing them
        // as MCP tools is coming soon (tenant MCP servers must be remote, never
        // a process spawned in the worker)
        const [integration] = await db
          .insert(integrationTable)
          .values({
            organizationId: stateRecord.organizationId,
            definitionId: stateRecord.definitionId,
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

        // Validate returnUrl is a relative path to prevent open redirect
        const returnUrl = stateRecord.returnUrl;
        const safeReturnUrl =
          returnUrl && returnUrl.startsWith("/") ? returnUrl : "/integrations";

        // Build success redirect URL
        const successUrl = new URL(`${appBaseUrl}${safeReturnUrl}`);
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
          "An error occurred during authentication",
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
    async ({ params: _params, body, headers, set }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo) {
        set.status = 401;
        return { error: "Invalid or missing API key" };
      }

      const { integrationId } = body;

      // Verify integration exists
      const integration = await db.query.integrationTable.findFirst({
        where: eq(integrationTable.id, integrationId),
      });

      if (!integration) {
        set.status = 404;
        return { error: "Integration not found" };
      }

      if (integration.organizationId !== authInfo.organizationId) {
        set.status = 403;
        return { error: "Not authorized for this integration" };
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
    async ({ params, headers, set }) => {
      const authInfo = await resolveAuth(headers.authorization);
      if (!authInfo) {
        set.status = 401;
        return { error: "Invalid or missing API key" };
      }

      const { integrationId } = params;

      const integration = await db.query.integrationTable.findFirst({
        where: eq(integrationTable.id, integrationId),
      });

      if (!integration) {
        set.status = 404;
        return { error: "Integration not found" };
      }

      if (integration.organizationId !== authInfo.organizationId) {
        set.status = 403;
        return { error: "Not authorized for this integration" };
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
