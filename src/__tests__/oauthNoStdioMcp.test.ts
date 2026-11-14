/**
 * OAuth integration MCP security tests.
 *
 * The OAuth callback used to create a stdio `mcp_server` row for the tenant
 * (`npx -y <package>` from the integration definition), i.e. a process the
 * worker would spawn inside its own pod. Tenant MCP servers must be remote
 * (sse or http) and go through the validated GraphQL path, so no server-side
 * code may insert MCP server rows directly
 */

import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const srcDir = join(import.meta.dirname, "..");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return ["__tests__", "generated"].includes(entry) ? [] : walk(path);
    }
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });

describe("tenant MCP server creation", () => {
  it("the OAuth callback no longer creates an MCP server", () => {
    const source = readFileSync(join(srcDir, "lib/oauth/routes.ts"), "utf-8");

    expect(source).not.toContain("insert(mcpServerTable)");
    expect(source).not.toContain("mcpCommand");
  });

  it("no server-side code inserts MCP server rows directly", () => {
    const offenders = walk(srcDir).filter((file) =>
      /insert\(\s*mcpServerTable\s*\)/.test(readFileSync(file, "utf-8")),
    );

    expect(offenders).toEqual([]);
  });
});
