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
import { useGrafast } from "grafast/envelop";
import webhooks from "webhooks";

import appConfig from "lib/config/app.config";
import {
  CORS_ALLOWED_ORIGINS,
  PORT,
  isDevEnv,
  isProdEnv,
} from "lib/config/env.config";
import { generateRequestId } from "lib/context";
import { dbPool, pgPool } from "lib/db/db";
import createGraphqlContext from "lib/graphql/createGraphqlContext";
import { armorPlugin, authenticationPlugin } from "lib/graphql/plugins";
import logger from "lib/logger";
import {
  closeCache,
  initCache,
  isCacheConfigured,
  cacheClient,
} from "lib/cache";
import { startCronScheduler, stopCronScheduler } from "lib/triggers";

// Error tracking: OpenTelemetry traces/logs sent to HyperDX via instrumentation.ts

/**
 * Elysia server.
 */
const app = new Elysia({
  ...(isDevEnv && {
    serve: {
      // https://elysiajs.com/patterns/configuration#serve-tls
      // https://bun.sh/guides/http/tls
      // NB: Elysia (and Bun) trust the well-known CA list curated by Mozilla (https://wiki.mozilla.org/CA/Included_Certificates), but they can be customized here if needed (`tls.ca` option)
      tls: {
        certFile: "cert.pem",
        keyFile: "key.pem",
      },
    },
  }),
})
  // Derive correlation ID from incoming request or generate a new one
  .derive(({ request }) => {
    const requestId =
      request.headers.get("X-Request-Id") || generateRequestId();
    return { requestId };
  })
  // Global error handler - errors are captured by OpenTelemetry instrumentation
  .onError(({ error, path }) => {
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
    set.headers["X-Request-Id"] = requestId;
  })
  .use(
    cors({
      origin: CORS_ALLOWED_ORIGINS!.split(","),
      methods: ["GET", "POST", "OPTIONS"],
    }),
  )
  // Rate limiting: 100 requests per minute per IP
  .use(
    rateLimit({
      max: 100,
      duration: 60_000,
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
    } else if (cacheClient?.isOpen) {
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
      plugins: [
        ...armorPlugin,
        authenticationPlugin,
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

// Start cron scheduler for scheduled workflow triggers
startCronScheduler();

/**
 * Graceful shutdown handler.
 */
const shutdown = async (signal: string) => {
  logger.info("Shutting down gracefully", { signal });

  // Stop accepting new connections
  app.stop();

  // Stop cron scheduler
  stopCronScheduler();

  // Close cache connection
  await closeCache();

  // Close database pool
  await pgPool.end();

  logger.info("Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
