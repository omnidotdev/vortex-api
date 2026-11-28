/**
 * Prepare an OAuth authorization URL for connecting an integration.
 *
 * Shared by `GET /:provider/authorize` (API-key clients, which follow the
 * redirect) and `POST /:provider/authorize-url` (the browser app, which sends
 * its session in the Authorization header and then navigates to the returned
 * provider URL). Both run the same checks in the same order
 */

import { eq } from "drizzle-orm";

import resolveAuth from "lib/auth/resolveAuth";
import { getOAuthCredentials } from "lib/config/env.config";
import { dbPool } from "lib/db/db";
import { integrationDefinitionTable } from "lib/db/schema";
import authorize from "lib/warden/authorize";
import { isIntegrationConnectAllowed } from "./connectLimit";
import { getOAuthProvider, isOAuthProviderSupported } from "./providers";
import { createOAuthState } from "./state";
import { getOAuthCallbackUrl } from "./tokens";

/** Input shared by both authorization entry points */
export interface AuthorizationRequest {
  authorization: string | undefined;
  provider: string;
  organizationId: string;
  definitionId: string;
  scopes?: string;
  returnUrl?: string;
}

/** Either the provider URL to send the user to, or an HTTP error */
export type AuthorizationResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

/**
 * Collaborators for {@link prepareAuthorizationUrl}. Each defaults to the real
 * implementation; tests inject fakes to exercise the checks without a
 * database, Warden, or billing service
 */
interface AuthorizationUrlDeps {
  resolveAuth?: typeof resolveAuth;
  authorize?: typeof authorize;
  isIntegrationConnectAllowed?: typeof isIntegrationConnectAllowed;
  getOAuthCredentials?: typeof getOAuthCredentials;
  findDefinition?: (
    definitionId: string,
  ) => Promise<{ supportsOAuth: boolean | null } | undefined>;
  createOAuthState?: typeof createOAuthState;
}

const findDefinitionById = (definitionId: string) =>
  dbPool.query.integrationDefinitionTable.findFirst({
    where: eq(integrationDefinitionTable.id, definitionId),
    columns: { supportsOAuth: true },
  });

/**
 * Run the connect checks and build the provider authorization URL.
 *
 * Checks, in order: caller authentication, workspace ownership, Warden admin
 * (session callers, matching the GraphQL `createIntegration` path), the
 * connected-accounts plan limit, provider support and configuration, and the
 * integration definition. Only then is OAuth state persisted
 */
export const prepareAuthorizationUrl = async (
  request: AuthorizationRequest,
  deps: AuthorizationUrlDeps = {},
): Promise<AuthorizationResult> => {
  const {
    resolveAuth: resolveAuthFn = resolveAuth,
    authorize: authorizeFn = authorize,
    isIntegrationConnectAllowed: connectAllowed = isIntegrationConnectAllowed,
    getOAuthCredentials: getCredentials = getOAuthCredentials,
    findDefinition = findDefinitionById,
    createOAuthState: createState = createOAuthState,
  } = deps;

  const { provider, organizationId, definitionId, scopes, returnUrl } = request;

  // Scope session callers to the requested workspace so a member of several
  // workspaces resolves to the one they are connecting for
  const authInfo = await resolveAuthFn(request.authorization, organizationId);
  if (!authInfo) {
    return { ok: false, status: 401, error: "Invalid or missing credentials" };
  }

  if (organizationId !== authInfo.organizationId) {
    return {
      ok: false,
      status: 403,
      error: "Not authorized for this workspace",
    };
  }

  // Session callers need admin, as on the GraphQL create path. API keys are
  // already bound to their workspace
  if (authInfo.userId) {
    const allowed = authInfo.idpUserId
      ? await authorizeFn(
          authInfo.idpUserId,
          "organization",
          organizationId,
          "admin",
        )
      : false;
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: "Only workspace admins can connect integrations",
      };
    }
  }

  // Enforce the connected-accounts limit (every plan can connect
  // integrations, only the count differs)
  const connectLimit = await connectAllowed(organizationId);
  if (!connectLimit.allowed) {
    return {
      ok: false,
      status: 403,
      error: `Plan limit reached: connected accounts (${connectLimit.current}/${connectLimit.limit}). Upgrade your plan to continue.`,
    };
  }

  if (!isOAuthProviderSupported(provider)) {
    return {
      ok: false,
      status: 400,
      error: `Unsupported OAuth provider: ${provider}`,
    };
  }

  const credentials = getCredentials(provider);
  if (!credentials) {
    return {
      ok: false,
      status: 503,
      error: "This integration cannot be connected right now",
    };
  }

  const definition = await findDefinition(definitionId);
  if (!definition) {
    return {
      ok: false,
      status: 404,
      error: "Integration definition not found",
    };
  }

  if (!definition.supportsOAuth) {
    return {
      ok: false,
      status: 400,
      error: "This integration does not support OAuth",
    };
  }

  const providerConfig = getOAuthProvider(provider);
  const redirectUri = getOAuthCallbackUrl(provider);

  const { state, codeChallenge } = await createState({
    organizationId,
    provider,
    definitionId,
    scopes: scopes?.split(","),
    redirectUri,
    returnUrl,
  });

  // Only public values go in this URL: the client id, the callback, the
  // one-time state nonce, and the PKCE challenge. Never the client secret or
  // the caller's credentials
  const authUrl = new URL(providerConfig.authorizationUrl);
  authUrl.searchParams.set("client_id", credentials.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  const finalScopes = scopes?.split(",") ?? providerConfig.defaultScopes;
  authUrl.searchParams.set("scope", finalScopes.join(" "));

  if (codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  if (providerConfig.authParams) {
    for (const [key, value] of Object.entries(providerConfig.authParams)) {
      authUrl.searchParams.set(key, value);
    }
  }

  return { ok: true, url: authUrl.toString() };
};
