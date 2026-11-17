/**
 * Synapse integration definition.
 *
 * The worker's agent and model registry steps default to Synapse and read the
 * org's key from the `synapse` integration's `apiKey` config field, so the
 * catalog must offer a Synapse integration with exactly that secret field and
 * no MCP server behind it
 */

import { describe, expect, it } from "bun:test";

import { featuredIntegrationDefinitions } from "lib/db/seeds/integrationDefinitions.seed";

const synapse = featuredIntegrationDefinitions.find((d) => d.id === "synapse");

describe("synapse integration definition", () => {
  it("is a featured, enabled AI integration", () => {
    expect(synapse).toBeDefined();
    expect(synapse?.category).toBe("ai");
    expect(synapse?.isFeatured).toBe(true);
    expect(synapse?.isEnabled).toBe(true);
  });

  it("stores the key under the apiKey field the worker reads, as a secret", () => {
    if (!synapse) throw new Error("synapse definition missing");
    expect(synapse.authType).toBe("api_key");
    const field = synapse.authFields.apiKey;
    expect(field?.secret).toBe(true);
    expect(field?.required).toBe(true);
  });

  it("does not define an MCP server package or args", () => {
    expect(synapse?.mcpPackage).toBe("");
    expect(synapse?.mcpArgs).toEqual([]);
  });
});
