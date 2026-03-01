import type { KnipConfig } from "knip";

/**
 * Knip configuration.
 * @see https://knip.dev/overview/configuration
 */
const knipConfig: KnipConfig = {
  ignore: [
    "**/generated/**",
    "src/lib/config/drizzle.config.ts",
    "src/scripts/**",
    "scripts/**",
    "src/lib/db/db.ts",
    "src/lib/config/env.config.ts",
    // Relations are used via star import in db.ts
    "src/lib/db/schema/relations.ts",
    // Seeds are run manually
    "src/lib/db/seeds/**",
    // Crypto is used by encryption plugin at runtime
    "src/lib/crypto/**",
    // Test files are run via bun test
    "src/__tests__/**",
    // WIP: Warden and Aether clients (not yet integrated)
    "src/lib/warden/**",
    "src/lib/aether/**",
    // Polling trigger scheduler (not yet wired into app entrypoint)
    "src/lib/triggers/polling.ts",
    // Instrumentation loaded via --import flag at runtime
    "src/instrumentation.ts",
    // Events client (not yet wired into app entrypoint)
    "src/lib/events/**",
  ],
  ignoreDependencies: [
    // Transitive dep of postgraphile, used directly for smart tags
    "graphile-utils",
    // OpenTelemetry deps used by instrumentation.ts (loaded via --import)
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/exporter-logs-otlp-http",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/sdk-node",
    "@opentelemetry/semantic-conventions",
  ],
  tags: ["-knipignore"],
};

export default knipConfig;
