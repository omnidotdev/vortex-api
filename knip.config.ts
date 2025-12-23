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
    "src/lib/db/db.ts",
    "src/lib/config/env.config.ts",
    // Plugin system (future use)
    "src/lib/plugins/**",
    // Workflow executors (future use)
    "src/lib/workflow/**",
  ],
  ignoreDependencies: [
    "drizzle-kit",
    // Future use dependencies
    "jose",
    "zod",
  ],
  tags: ["-knipignore"],
};

export default knipConfig;
