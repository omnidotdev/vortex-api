import {
  createUnauthenticatedError,
  useGenericAuth,
} from "@envelop/generic-auth";
import { QueryClient } from "@tanstack/query-core";
import { and, eq, notInArray } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import ms from "ms";

import { AUTH_BASE_URL, protectRoutes } from "lib/config/env.config";
import { userOrganizationTable, userTable } from "lib/db/schema";
import logger from "lib/logger";

import type {
  ResolveUserFn,
  ValidateUserFnParams,
} from "@envelop/generic-auth";
import type { JWTPayload } from "jose";
import type {
  InsertUser,
  InsertUserOrganization,
  SelectUser,
} from "lib/db/schema";
import type { GraphQLContext } from "lib/graphql/createGraphqlContext";

/** Claim key for organization claims in JWT. */
const OMNI_CLAIMS_ORGANIZATIONS =
  "https://manifold.omni.dev/@omni/claims/organizations";

interface OrganizationClaim {
  id: string;
  slug: string;
  name?: string;
  type: "personal" | "team";
  roles: string[];
  teams: Array<{ id: string; name: string }>;
}

interface UserInfoClaims extends JWTPayload {
  sub: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  email?: string;
  [OMNI_CLAIMS_ORGANIZATIONS]?: OrganizationClaim[];
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
 * Lazily initialized to avoid errors during build scripts when AUTH_BASE_URL is not set.
 * @see https://www.better-auth.com/docs/plugins/jwt
 */
let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!JWKS) {
    if (!AUTH_BASE_URL) {
      throw new AuthenticationError(
        "AUTH_BASE_URL is not configured",
        "AUTH_CONFIG_MISSING",
      );
    }
    JWKS = createRemoteJWKSet(
      new URL(`${AUTH_BASE_URL}/.well-known/jwks.json`),
    );
  }
  return JWKS;
}

/**
 * Verify JWT signature using Gatekeeper's JWKS endpoint.
 * Returns the verified payload or throws an error.
 */
async function verifyAccessToken(token: string): Promise<UserInfoClaims> {
  const { payload } = await jwtVerify(token, getJWKS(), {
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

    // Better Auth OIDC access tokens are opaque tokens, not JWTs.
    // Validation is done via the userinfo endpoint which verifies the token server-side.
    // If the access token looks like a JWT (3 dot-separated parts), we can optionally
    // verify it for additional security, but this is not required.
    const isJwtFormat = accessToken.split(".").length === 3;
    if (isJwtFormat) {
      try {
        const verifiedPayload = await verifyAccessToken(accessToken);
        validateClaims(verifiedPayload);
      } catch (jwtError) {
        // JWT verification failed - this is expected for opaque tokens
        // Continue with userinfo validation which will definitively validate the token
        logger.warn("JWT verification skipped (opaque token)", {
          error:
            jwtError instanceof Error ? jwtError.message : String(jwtError),
        });
      }
    }

    // Fetch user claims from userinfo endpoint - this validates the access token
    // and provides the authoritative user identity claims
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

    // Sync organization memberships from JWT claims
    const orgClaims = claims[OMNI_CLAIMS_ORGANIZATIONS];
    if (orgClaims && Array.isArray(orgClaims) && orgClaims.length > 0) {
      const memberships: InsertUserOrganization[] = orgClaims.map((org) => ({
        userId: user.id,
        organizationId: org.id,
        slug: org.slug,
        name: org.name,
        type: org.type as "personal" | "team",
        role: (org.roles?.includes("owner")
          ? "owner"
          : org.roles?.includes("admin")
            ? "admin"
            : "member") as "owner" | "admin" | "member",
        syncedAt: new Date().toISOString(),
      }));

      // Upsert all memberships
      for (const membership of memberships) {
        await ctx.db
          .insert(userOrganizationTable)
          .values(membership)
          .onConflictDoUpdate({
            target: [
              userOrganizationTable.userId,
              userOrganizationTable.organizationId,
            ],
            set: {
              slug: membership.slug,
              name: membership.name,
              type: membership.type,
              role: membership.role,
              syncedAt: membership.syncedAt,
              updatedAt: new Date().toISOString(),
            },
          });
      }

      // Remove stale memberships no longer present in IDP claims
      const currentOrgIds = orgClaims.map((org) => org.id);
      await ctx.db
        .delete(userOrganizationTable)
        .where(
          and(
            eq(userOrganizationTable.userId, user.id),
            notInArray(userOrganizationTable.organizationId, currentOrgIds),
          ),
        );
    }

    return user;
  } catch (err) {
    if (err instanceof AuthenticationError) {
      logger.error("Authentication failed", {
        code: err.code,
        error: err.message,
      });
    } else {
      logger.error("Unexpected authentication error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return null;
  }
};

/**
 * Query fields that are publicly accessible without authentication.
 * These are read-only catalog/reference data shared across all users.
 */
const PUBLIC_QUERY_FIELDS = new Set([
  "integrationDefinitions",
  "integrationDefinition",
  "integrationDefinitionById",
]);

/**
 * Validate user for field access in `protect-all` mode.
 * Allow public catalog fields without auth; require auth for everything else.
 */
const validateUser = (
  params: ValidateUserFnParams<SelectUser>,
): void | ReturnType<typeof createUnauthenticatedError> => {
  // Allow public catalog queries without authentication
  if (
    params.parentType.name === "Query" &&
    PUBLIC_QUERY_FIELDS.has(params.fieldNode.name.value)
  ) {
    return;
  }

  if (params.user == null && !params.fieldAuthArgs && !params.typeAuthArgs) {
    return createUnauthenticatedError({
      fieldNode: params.fieldNode,
      path: params.path,
    });
  }
};

/**
 * Authentication plugin.
 *
 * In production, uses "protect-all" mode with a custom `validateUser` that
 * allows public catalog queries (e.g. `integrationDefinitions`) without auth.
 * In development, uses "resolve-only" mode to allow unauthenticated access.
 *
 * @see https://the-guild.dev/graphql/envelop/plugins/use-generic-auth
 */
const authenticationPlugin = useGenericAuth({
  contextFieldName: "observer",
  resolveUserFn: resolveUser,
  mode: protectRoutes ? "protect-all" : "resolve-only",
  ...(protectRoutes && { validateUser }),
});

export default authenticationPlugin;
