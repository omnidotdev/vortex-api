/**
 * OAuth authorization URL tests.
 *
 * The app started OAuth with a bare browser navigation to
 * `GET /:provider/authorize`, which cannot carry the session in an
 * Authorization header, so every connect attempt was rejected as
 * unauthenticated. `POST /:provider/authorize-url` takes the session in the
 * header and returns the provider URL for the app to navigate to. Both entry
 * points share `prepareAuthorizationUrl`, exercised here with injected fakes
 */

import { describe, expect, it } from "bun:test";

import { prepareAuthorizationUrl } from "lib/oauth/authorizationUrl";
import oauthRoutes from "lib/oauth/routes";

const ORG = "org-1";

const sessionCaller = {
  organizationId: ORG,
  userId: "user-1",
  idpUserId: "idp-1",
};

const request = {
  authorization: "Bearer session-token",
  provider: "github",
  organizationId: ORG,
  definitionId: "github",
};

/**
 * Fakes for a session admin on a workspace under its limit, with GitHub
 * configured. Individual tests override one collaborator at a time.
 */
const passingDeps = () => {
  const calls = { authorize: [] as unknown[][], createState: 0 };

  return {
    calls,
    deps: {
      resolveAuth: async () => sessionCaller,
      authorize: async (...args: unknown[]) => {
        calls.authorize.push(args);
        return true;
      },
      isIntegrationConnectAllowed: async () => ({
        allowed: true,
        limit: 10,
        current: 2,
      }),
      getOAuthCredentials: () => ({
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
      findDefinition: async () => ({ supportsOAuth: true }),
      createOAuthState: async () => {
        calls.createState += 1;
        return { state: "state-nonce", codeChallenge: "challenge" };
      },
    },
  };
};

describe("prepareAuthorizationUrl", () => {
  it("returns the provider URL for a session admin under the limit", async () => {
    const { deps, calls } = passingDeps();

    const result = await prepareAuthorizationUrl(request, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.url);
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-nonce");
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(calls.authorize).toEqual([["idp-1", "organization", ORG, "admin"]]);
    expect(calls.createState).toBe(1);
  });

  it("never puts the caller's credentials or the client secret in the URL", async () => {
    const { deps } = passingDeps();

    const result = await prepareAuthorizationUrl(request, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toContain("session-token");
    expect(result.url).not.toContain("client-secret");
  });

  it("scopes session auth to the requested workspace", async () => {
    const { deps } = passingDeps();
    const seen: unknown[] = [];

    await prepareAuthorizationUrl(request, {
      ...deps,
      resolveAuth: async (...args: unknown[]) => {
        seen.push(...args);
        return sessionCaller;
      },
    });

    expect(seen).toEqual(["Bearer session-token", ORG]);
  });

  it("rejects an unauthenticated caller", async () => {
    const { deps } = passingDeps();

    const result = await prepareAuthorizationUrl(request, {
      ...deps,
      resolveAuth: async () => null,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a session member who is not a workspace admin", async () => {
    const { deps, calls } = passingDeps();

    const result = await prepareAuthorizationUrl(request, {
      ...deps,
      authorize: async () => false,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(calls.createState).toBe(0);
  });

  it("skips the Warden check for API keys bound to the workspace", async () => {
    const { deps, calls } = passingDeps();

    const result = await prepareAuthorizationUrl(request, {
      ...deps,
      resolveAuth: async () => ({ organizationId: ORG, name: "ci-key" }),
    });

    expect(result.ok).toBe(true);
    expect(calls.authorize).toEqual([]);
  });

  it("rejects a workspace at its connected-account limit with a plan message", async () => {
    const { deps, calls } = passingDeps();

    const result = await prepareAuthorizationUrl(request, {
      ...deps,
      isIntegrationConnectAllowed: async () => ({
        allowed: false,
        limit: 10,
        current: 10,
      }),
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    if (result.ok) return;
    expect(result.error).toContain("Plan limit reached");
    expect(calls.createState).toBe(0);
  });
});

describe("POST /api/v1/oauth/:provider/authorize-url", () => {
  it("is mounted and rejects a request without credentials", async () => {
    const response = await oauthRoutes.handle(
      new Request("http://localhost/api/v1/oauth/github/authorize-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: ORG, definitionId: "github" }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
