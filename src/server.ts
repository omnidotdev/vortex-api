import { cors } from "@elysiajs/cors";
import { yoga } from "@elysiajs/graphql-yoga";
import { useOpenTelemetry } from "@envelop/opentelemetry";
import { useParserCache } from "@envelop/parser-cache";
import { useValidationCache } from "@envelop/validation-cache";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";
import api from "api";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { schema } from "generated/graphql/schema.executable";
import { isSafeError } from "grafast";
import { useGrafast } from "grafast/envelop";
import { GraphQLError } from "graphql";
import { maskError } from "graphql-yoga";
import webhooks from "webhooks";

import {
  cacheClient,
  closeCache,
  initCache,
  isCacheConfigured,
} from "lib/cache";
import appConfig, { getEventsConfig } from "lib/config/app.config";
import {
  CORS_ALLOWED_ORIGINS,
  PLATFORM_ORG_ID,
  PORT,
  isDevEnv,
  isProdEnv,
} from "lib/config/env.config";
import { generateRequestId } from "lib/context";
import { dbPool, pgPool } from "lib/db/db";
import seedCronWorkflows from "lib/db/seeds/cronWorkflows.seed";
import { seedEventSchemas } from "lib/db/seeds/eventSchema.seed";
import { seedIntegrationDefinitions } from "lib/db/seeds/integrationDefinitions.seed";
import { seedWorkflowTemplates } from "lib/db/seeds/workflowTemplates.seed";
import EventsClient from "lib/events";
import createGraphqlContext from "lib/graphql/createGraphqlContext";
import { armorPlugin, authenticationPlugin } from "lib/graphql/plugins";
import logger from "lib/logger";
import Sentry from "lib/sentry";
import {
  startCronScheduler,
  startPollingScheduler,
  startStaleRunReaper,
  startWardenSyncPoller,
  stopCronScheduler,
  stopPollingScheduler,
  stopStaleRunReaper,
  stopWardenSyncPoller,
} from "lib/triggers";

// Error tracking: OpenTelemetry traces/logs sent to HyperDX via instrumentation.ts

/**
 * Elysia server.
 */
const app = new Elysia({
  serve: {
    maxRequestBodySize: 1_048_576,
    ...(isDevEnv && {
      // https://elysiajs.com/patterns/configuration#serve-tls
      // https://bun.sh/guides/http/tls
      // NB: Elysia (and Bun) trust the well-known CA list curated by Mozilla (https://wiki.mozilla.org/CA/Included_Certificates), but they can be customized here if needed (`tls.ca` option)
      tls: {
        certFile: "cert.pem",
        keyFile: "key.pem",
      },
    }),
  },
})
  // Derive correlation ID from incoming request or generate a new one
  .derive(({ request }) => {
    const requestId =
      request.headers.get("X-Request-Id") || generateRequestId();
    return { requestId };
  })
  // Global error handler - errors are captured by OpenTelemetry instrumentation
  .onError(({ error, path }) => {
    Sentry.captureException(error, { extra: { path } });
    logger.error("Request error", {
      path,
      error: "message" in error ? error.message : String(error),
    });
  })
  // Security headers middleware
  .onAfterHandle(({ set, requestId }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["X-Frame-Options"] = "DENY";
    set.headers["X-XSS-Protection"] = "1; mode=block";
    set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    set.headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
    set.headers["X-Request-Id"] = requestId;
  })
  .use(
    cors({
      origin: CORS_ALLOWED_ORIGINS!.split(","),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    }),
  )
  // Rate limiting: 100 requests per minute per IP
  .use(
    rateLimit({
      max: 100,
      duration: 60_000,
      generator: (req) =>
        req.headers.get("cf-connecting-ip") ??
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "unknown",
      skip: (req) => {
        const url = new URL(req.url);
        return url.pathname === "/health" || url.pathname === "/ready";
      },
    }),
  )
  // Health check endpoints
  .get("/health", () => ({
    status: "ok",
    timestamp: Date.now(),
    service: appConfig.name,
  }))
  .get("/ready", async ({ set }) => {
    let database: "connected" | "disconnected" = "disconnected";
    let cache: "connected" | "disconnected" | "not_configured" =
      "not_configured";

    // Check database
    try {
      await dbPool.execute(sql`SELECT 1`);
      database = "connected";
    } catch {
      database = "disconnected";
    }

    // Check cache
    if (!isCacheConfigured()) {
      cache = "not_configured";
    } else if (cacheClient?.status === "ready") {
      try {
        await cacheClient.ping();
        cache = "connected";
      } catch {
        cache = "disconnected";
      }
    } else {
      cache = "disconnected";
    }

    // 503 if any required dependency is down
    // not_configured is acceptable (dev mode), only disconnected triggers 503
    const isReady = database === "connected" && cache !== "disconnected";

    if (!isReady) {
      set.status = 503;
    }

    return {
      status: isReady ? "ready" : "not ready",
      database,
      cache,
      version: appConfig.version,
      uptime: Math.floor(process.uptime()),
      timestamp: Date.now(),
    };
  })
  .use(api)
  .use(webhooks)
  .use(
    yoga({
      schema,
      context: createGraphqlContext,
      graphiql: isDevEnv,
      maskedErrors: isProdEnv && {
        maskError: (error: unknown, message: string, isDev?: boolean) => {
          // Allow Grafast SafeError messages through (designed to be user-facing)
          if (
            error instanceof GraphQLError &&
            error.originalError &&
            isSafeError(error.originalError)
          ) {
            return error;
          }

          return maskError(error, message, isDev);
        },
      },
      plugins: [
        ...armorPlugin,
        ...authenticationPlugin,
        // disable GraphQL schema introspection in production to mitigate reverse engineering
        isProdEnv && useDisableIntrospection(),
        isProdEnv &&
          useOpenTelemetry({
            variables: true,
            result: true,
          }),
        // parser and validation caches recommended for Grafast (https://grafast.org/grafast/servers#envelop)
        useParserCache(),
        useValidationCache(),
        useGrafast(),
      ],
    }),
  )
  .listen(PORT);

logger.info("Elysia server running", {
  url: app.server?.url.toString().slice(0, -1),
});

logger.info("GraphQL Yoga API running", {
  url: `${app.server?.url}graphql`,
});

// Initialize cache for distributed locking (if configured)
await initCache();

// Seed integration definitions and event schemas (idempotent upsert on every startup)
seedIntegrationDefinitions(dbPool).catch((err) =>
  logger.error("Failed to seed integration definitions", {
    error: String(err),
  }),
);

if (PLATFORM_ORG_ID) {
  seedEventSchemas(dbPool, PLATFORM_ORG_ID).catch((err) =>
    logger.error("Failed to seed event schemas", {
      error: String(err),
    }),
  );
}

seedWorkflowTemplates(dbPool).catch((err) =>
  logger.error("Failed to seed workflow templates", {
    error: String(err),
  }),
);

if (PLATFORM_ORG_ID) {
  seedCronWorkflows(dbPool, PLATFORM_ORG_ID).catch((err) =>
    logger.error("Failed to seed cron workflows", {
      error: String(err),
    }),
  );
}

// Initialize events client (if configured)
let eventsClient: EventsClient | null = null;
const eventsConfig = getEventsConfig();

if (eventsConfig) {
  eventsClient = new EventsClient(eventsConfig);
  await eventsClient.initialize();
} else {
  logger.warn("EVENTS_URL not set — event streaming disabled");
}

export { eventsClient };

// Start cron scheduler for scheduled workflow triggers
startCronScheduler();

// Start polling scheduler for HTTP polling triggers
startPollingScheduler();

// Start stale run reaper for detecting timed-out executions
startStaleRunReaper();

// Start Warden sync poller for retrying failed authorization tuple writes
startWardenSyncPoller();

/**
 * Graceful shutdown handler.
 */
const shutdown = async (signal: string) => {
  logger.info("Shutting down gracefully", { signal });

  // Stop accepting new connections
  app.stop();

  // Stop cron scheduler
  stopCronScheduler();

  // Stop polling scheduler
  stopPollingScheduler();

  // Stop stale run reaper
  stopStaleRunReaper();

  // Stop Warden sync poller
  stopWardenSyncPoller();

  // Close events client
  eventsClient?.close();

  // Close cache connection
  await closeCache();

  // Close database pool
  await pgPool.end();

  logger.info("Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
