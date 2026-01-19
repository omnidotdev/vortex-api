import { useGenericAuth } from "@envelop/generic-auth";
import { QueryClient } from "@tanstack/query-core";
import { eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import ms from "ms";

import { AUTH_BASE_URL, protectRoutes } from "lib/config/env.config";
import { userTable, workspaceTable, workspaceUserTable } from "lib/db/schema";

import type { ResolveUserFn } from "@envelop/generic-auth";
import type { JWTPayload } from "jose";
import type { InsertUser, SelectUser } from "lib/db/schema";
import type { GraphQLContext } from "lib/graphql/createGraphqlContext";

interface UserInfoClaims extends JWTPayload {
  sub: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  picture?: string;
}

class AuthenticationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: ms("2m"),
    },
  },
});

/**
 * Remote JWKS for verifying JWT signatures from Gatekeeper.
 * jose's createRemoteJWKSet handles caching and key rotation automatically.
 * @see https://www.better-auth.com/docs/plugins/jwt
 */
const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_BASE_URL}/.well-known/jwks.json`),
);

/**
 * Verify JWT signature using Gatekeeper's JWKS endpoint.
 * Returns the verified payload or throws an error.
 */
async function verifyAccessToken(token: string): Promise<UserInfoClaims> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: AUTH_BASE_URL,
  });

  if (!payload.sub) {
    throw new AuthenticationError(
      "Missing required 'sub' claim",
      "MISSING_SUB_CLAIM",
    );
  }

  return payload as UserInfoClaims;
}

/**
 * Validate token claims.
 */
const validateClaims = (claims: UserInfoClaims): void => {
  const now = Math.floor(Date.now() / 1000);

  // validate `exp`
  if (claims.exp !== undefined && claims.exp < now)
    throw new AuthenticationError("Token has expired", "TOKEN_EXPIRED");

  // validate `iat` (reject tokens issued in the future with clock skew allowance)
  if (claims.iat !== undefined && claims.iat > now + ms("1m"))
    throw new AuthenticationError(
      "Token issued in the future",
      "INVALID_TOKEN_IAT",
    );

  // validate issuer
  if (AUTH_BASE_URL && claims.iss !== undefined && claims.iss !== AUTH_BASE_URL)
    throw new AuthenticationError(
      "Token issuer mismatch",
      "INVALID_TOKEN_ISSUER",
    );
};

/**
 * Validate user session and resolve user if successful.
 * @see https://the-guild.dev/graphql/envelop/plugins/use-generic-auth#getting-started
 */
const resolveUser: ResolveUserFn<SelectUser, GraphQLContext> = async (ctx) => {
  try {
    const accessToken = ctx.request.headers
      .get("authorization")
      ?.split("Bearer ")[1];

    if (!accessToken) {
      if (!protectRoutes) return null;

      throw new AuthenticationError(
        "Invalid or missing access token",
        "MISSING_TOKEN",
      );
    }

    // Verify JWT signature using JWKS (cryptographic verification)
    const verifiedPayload = await verifyAccessToken(accessToken);

    // Fetch additional claims from userinfo (org membership, profile data)
    // Access tokens may not contain all claims, userinfo provides the full set
    const claims = await queryClient.ensureQueryData({
      queryKey: ["UserInfo", { accessToken }],
      queryFn: async () => {
        const response = await fetch(`${AUTH_BASE_URL}/oauth2/userinfo`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new AuthenticationError(
            "Invalid access token or request failed",
            "USERINFO_FAILED",
          );
        }

        const userInfoClaims: UserInfoClaims = await response.json();

        return userInfoClaims;
      },
    });

    if (!claims) {
      if (!protectRoutes) return null;

      throw new AuthenticationError(
        "Invalid access token or request failed",
        "INVALID_CLAIMS",
      );
    }

    // Validate time-based claims from verified payload
    validateClaims(verifiedPayload);

    if (!claims.email)
      throw new AuthenticationError(
        "Missing required 'email' claim",
        "MISSING_EMAIL_CLAIM",
      );

    const insertedUser: InsertUser = {
      identityProviderId: claims.sub,
      name: claims.name ?? claims.preferred_username ?? claims.email,
      email: claims.email,
      avatarUrl: claims.picture,
    };

    const { identityProviderId, ...rest } = insertedUser;

    const [user] = await ctx.db
      .insert(userTable)
      .values(insertedUser)
      .onConflictDoUpdate({
        target: userTable.identityProviderId,
        set: {
          ...rest,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    // Auto-add user to demo workspace if it exists
    const [demoWorkspace] = await ctx.db
      .select()
      .from(workspaceTable)
      .where(eq(workspaceTable.slug, "demo"))
      .limit(1);

    if (demoWorkspace) {
      await ctx.db
        .insert(workspaceUserTable)
        .values({
          workspaceId: demoWorkspace.id,
          userId: user.id,
          role: "owner",
        })
        .onConflictDoNothing();
    }

    return user;
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error(`[Auth] ${err.code}: ${err.message}`);
    } else {
      console.error("[Auth] Unexpected error:", err);
    }

    return null;
  }
};

/**
 * Authentication plugin.
 * @see https://the-guild.dev/graphql/envelop/plugins/use-generic-auth
 */
const authenticationPlugin = useGenericAuth({
  contextFieldName: "observer",
  resolveUserFn: resolveUser,
  mode: protectRoutes ? "protect-all" : "resolve-only",
});

export default authenticationPlugin;
