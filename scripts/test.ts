/**
 * Test runner with per-file process isolation.
 *
 * Bun's mock.module() is process-wide and permanent, so test files
 * that mock modules poison the registry for subsequent files.
 * This script runs each test file in its own subprocess.
 */

import { Glob } from "bun";

const glob = new Glob("src/__tests__/**/*.test.ts");
const files = Array.from(glob.scanSync(".")).sort();

let passed = 0;
let failed = 0;

for (const file of files) {
  const proc = Bun.spawnSync(["bun", "--env-file", ".env.local", "test", file], {
    cwd: import.meta.dir + "/..",
    env: {
      ...process.env,
      BUN_ENV: process.env.BUN_ENV ?? "test",
      // Provide dummy values for required env vars so mock.module() tests
      // don't crash during eager module evaluation before mocks take effect
      HATCHET_CLIENT_TOKEN:
        process.env.HATCHET_CLIENT_TOKEN ?? "test-placeholder",
    },
    stdio: ["inherit", "inherit", "inherit"],
  });

  if (proc.exitCode === 0) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`\n${passed + failed} files: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
