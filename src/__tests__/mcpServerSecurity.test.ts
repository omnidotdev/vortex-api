/**
 * MCP server and org-ownership mutation security tests.
 *
 * An org admin could register a stdio MCP server whose `command` the worker
 * spawned in its own pod, and any update mutation could rewrite a row's
 * `organizationId`, which let a tenant move a workflow or MCP server into the
 * platform org and inherit its trust (in-process code, platform template env).
 * These tests assert tenants are limited to remote MCP transports, and that no
 * GraphQL patch can change a row's organization
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateMcpServerConfig } from "lib/validation/mcpServer";

const PLATFORM_ORG = "33880602-cf32-4d8d-8db3-a4a9994c5d45";
const TENANT = "tenant-org";

const remote = {
  transport: "http",
  url: "https://mcp.example.com/mcp",
};

describe("validateMcpServerConfig", () => {
  it("rejects stdio for a tenant org", () => {
    expect(() =>
      validateMcpServerConfig(
        TENANT,
        { transport: "stdio", command: "sh", args: ["-c", "env"] },
        PLATFORM_ORG,
      ),
    ).toThrow();
  });

  it("rejects the stdio default (no transport) for a tenant org", () => {
    expect(() =>
      validateMcpServerConfig(TENANT, { command: "node" }, PLATFORM_ORG),
    ).toThrow();
    expect(() => validateMcpServerConfig(TENANT, {}, PLATFORM_ORG)).toThrow();
  });

  it("rejects spawn fields on a tenant remote server", () => {
    for (const extra of [
      { command: "sh" },
      { args: ["-c", "env"] },
      { env: { A: "b" } },
      { cwd: "/" },
    ]) {
      expect(() =>
        validateMcpServerConfig(TENANT, { ...remote, ...extra }, PLATFORM_ORG),
      ).toThrow();
    }
  });

  it("requires a url for a tenant remote server", () => {
    expect(() =>
      validateMcpServerConfig(TENANT, { transport: "sse" }, PLATFORM_ORG),
    ).toThrow();
  });

  it("treats every org as a tenant when the platform org is unset", () => {
    expect(() =>
      validateMcpServerConfig(
        PLATFORM_ORG,
        { transport: "stdio", command: "node" },
        undefined,
      ),
    ).toThrow();
  });

  it("accepts a tenant remote server", () => {
    for (const transport of ["http", "sse"]) {
      expect(() =>
        validateMcpServerConfig(
          TENANT,
          { ...remote, transport, args: [], env: {} },
          PLATFORM_ORG,
        ),
      ).not.toThrow();
    }
  });

  it("keeps platform-org stdio servers working", () => {
    expect(() =>
      validateMcpServerConfig(
        PLATFORM_ORG,
        { transport: "stdio", command: "node", args: ["server.js"] },
        PLATFORM_ORG,
      ),
    ).not.toThrow();
  });
});

describe("McpServer authorization plugin", () => {
  const source = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "lib/graphql/plugins/authorization/McpServer.plugin.ts",
    ),
    "utf-8",
  );

  it("validates the transport on create and on update", () => {
    const createBranch = source
      .split('scope === "create"')[1]
      ?.split("} else")[0];
    const updateBranch = source
      .split('scope === "create"')[1]
      ?.split("} else")[1];

    expect(createBranch).toContain("validateMcpServerConfig(");
    expect(updateBranch).toContain("validateMcpServerConfig(");
  });
});

describe("GraphQL patches", () => {
  const schema = readFileSync(
    join(import.meta.dirname, "..", "generated/graphql/schema.graphql"),
    "utf-8",
  );

  it("never let a mutation change a row's organization", () => {
    const patchesWithOrg: string[] = [];
    let current: string | null = null;

    for (const line of schema.split("\n")) {
      const header = line.match(/^input (\w+Patch) /);
      if (header) current = header[1] ?? null;
      else if (line.startsWith("}")) current = null;
      else if (current && /^\s+organizationId:/.test(line)) {
        patchesWithOrg.push(current);
      }
    }

    expect(patchesWithOrg).toEqual([]);
  });
});
