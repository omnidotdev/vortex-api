import { createWithPgClient } from "postgraphile/adaptors/pg";

import { generateRequestId } from "lib/context";
import { dbPool, pgPool } from "lib/db/db";

import type { YogaInitialContext } from "graphql-yoga";
import type { SelectUser } from "lib/db/schema";
import type { WithPgClient } from "postgraphile/@dataplan/pg";
import type {
  NodePostgresPgClient,
  PgSubscriber,
} from "postgraphile/adaptors/pg";

const withPgClient = createWithPgClient({ pool: pgPool });

// Merge declarations for `observer` and `db` which are used within plan resolvers
// See: https://grafast.org/grafast/step-library/standard-steps/context#typescript
declare global {
  namespace Grafast {
    interface Context {
      observer: SelectUser | null;
      organizationIds: string[];
      pgSettings: Record<string, string | undefined> | null;
      requestId: string;
      db: typeof dbPool;
    }
  }
}

export interface GraphQLContext {
  /** API observer, injected by the authentication plugin and controlled via `contextFieldName`. Related to the viewer pattern: https://wundergraph.com/blog/graphql_federation_viewer_pattern */
  observer: SelectUser | null;
  /** Organization IDs the authenticated user belongs to, for query scoping */
  organizationIds: string[];
  /** Network request. */
  request: Request;
  /** Correlation ID for request tracing. */
  requestId: string;
  /** Database. */
  db: typeof dbPool;
  /** Postgres client, injected by Postgraphile. */
  withPgClient: WithPgClient<NodePostgresPgClient>;
  /** Postgres settings for the current request, injected by Postgraphile. */
  pgSettings: Record<string, string | undefined> | null;
  /** Postgres subscription client for the current request, injected by Postgraphile. */
  pgSubscriber: PgSubscriber | null;
}

/**
 * Create a GraphQL context.
 * @see https://graphql.org/learn/execution/#root-fields-and-resolvers
 */
const createGraphqlContext = async ({
  request,
}: Omit<YogaInitialContext, "waitUntil">): Promise<
  Omit<
    GraphQLContext,
    "observer" | "organizationIds" | "pgSettings" | "pgSubscriber"
  >
> => ({
  request,
  requestId: request.headers.get("X-Request-Id") || generateRequestId(),
  db: dbPool,
  withPgClient,
});

export default createGraphqlContext;
