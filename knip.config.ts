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
  ],
  ignoreDependencies: ["drizzle-kit"],
  tags: ["-knipignore"],
};

export default knipConfig;
