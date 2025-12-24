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
    // Relations are used via star import in db.ts
    "src/lib/db/schema/relations.ts",
  ],
  ignoreDependencies: ["drizzle-kit"],
  tags: ["-knipignore"],
};

export default knipConfig;
