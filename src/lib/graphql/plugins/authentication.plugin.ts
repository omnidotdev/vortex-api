import { useGenericAuth } from "@envelop/generic-auth";
import { QueryClient } from "@tanstack/query-core";
import { and, eq, notInArray } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { createRemoteJWKSet, jwtVerify } from "jose";
import ms from "ms";

import { AUTH_BASE_URL } from "lib/config/env.config";
import { userOrganizationTable, userTable } from "lib/db/schema";
import logger from "lib/logger";

import type { ResolveUserFn } from "@envelop/generic-auth";
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

    if (!accessToken) return null;

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

    if (!claims) return null;

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

      // Inject pgSettings for Postgres RLS organization scoping
      (ctx as GraphQLContext).organizationIds = currentOrgIds;
      (ctx as GraphQLContext).pgSettings = {
        "app.user_id": user.id,
        "app.organization_ids": `{${currentOrgIds.join(",")}}`,
      };
    } else {
      // Fetch org IDs from local DB when JWT claims are not available
      const memberships = await ctx.db.query.userOrganizationTable.findMany({
        where: (table, { eq: eqOp }) => eqOp(table.userId, user.id),
        columns: { organizationId: true },
      });

      const orgIds = memberships.map((m) => m.organizationId);

      (ctx as GraphQLContext).organizationIds = orgIds;
      (ctx as GraphQLContext).pgSettings = {
        "app.user_id": user.id,
        "app.organization_ids": `{${orgIds.join(",")}}`,
      };
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
 * User resolution plugin.
 *
 * Uses "resolve-only" mode: resolves the user when a valid token is present
 * and sets `observer` on the GraphQL context. The authentication gate
 * (below) blocks unauthenticated requests from accessing data.
 *
 * @see https://the-guild.dev/graphql/envelop/plugins/use-generic-auth
 */
const resolveUserPlugin = useGenericAuth({
  contextFieldName: "observer",
  resolveUserFn: resolveUser,
  mode: "resolve-only",
});

/** GraphQL operation names that are allowed without authentication */
const PUBLIC_OPERATIONS = new Set(["IntrospectionQuery"]);

/** Top-level query field names that are allowed without authentication */
const PUBLIC_FIELDS = new Set(["__schema", "__type"]);

/**
 * Authentication gate plugin.
 *
 * Blocks unauthenticated requests from executing queries and mutations.
 * Introspection queries are allowed through for tooling compatibility
 * (production introspection is separately disabled by `useDisableIntrospection`).
 *
 * This is a custom envelop plugin that runs after `resolveUserPlugin` has
 * set `observer` on the context.
 */
const authenticationGatePlugin = {
  onExecute({
    args,
  }: {
    args: {
      contextValue: { observer: SelectUser | null };
      document: {
        definitions: ReadonlyArray<{
          kind: string;
          operation?: string;
          name?: { value: string };
          selectionSet?: {
            selections: ReadonlyArray<{
              kind: string;
              name?: { value: string };
            }>;
          };
        }>;
      };
    };
  }) {
    const { contextValue, document } = args;

    // Allow requests that already have a resolved user
    if (contextValue.observer) return;

    // Check if this is an introspection or public operation
    for (const definition of document.definitions) {
      if (definition.kind !== "OperationDefinition") continue;

      // Allow named introspection queries
      if (
        definition.name?.value &&
        PUBLIC_OPERATIONS.has(definition.name.value)
      ) {
        return;
      }

      // Allow queries that only request introspection fields (__schema, __type)
      if (definition.operation === "query" && definition.selectionSet) {
        const allPublic = definition.selectionSet.selections.every(
          (sel) =>
            sel.kind === "Field" &&
            sel.name?.value &&
            PUBLIC_FIELDS.has(sel.name.value),
        );
        if (allPublic) return;
      }
    }

    throw new GraphQLError("Authentication required", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  },
};

/**
 * Authentication plugins.
 *
 * Two-phase authentication:
 * 1. `resolveUserPlugin` resolves the user from Bearer token (sets `observer`)
 * 2. `authenticationGatePlugin` blocks unauthenticated data access
 */
const authenticationPlugin = [resolveUserPlugin, authenticationGatePlugin];

export default authenticationPlugin;
