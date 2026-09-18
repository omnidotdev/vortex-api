/**
 * Authentication gate fail-closed tests (P0-4 root).
 *
 * Reproduces the fail-open hole where a request that presented a Bearer token
 * which failed to resolve (garbage/revoked token, or IDP unreachable) was let
 * through with `observer === null`, relying solely on org scoping to protect
 * tenant data. The gate must instead deny any request without a resolved
 * observer, while still allowing introspection.
 */

import { describe, expect, it } from "bun:test";

import { authenticationGatePlugin } from "lib/graphql/plugins/authentication.plugin";

type Definition = {
  kind: string;
  operation?: string;
  name?: { value: string };
  selectionSet?: {
    selections: ReadonlyArray<{ kind: string; name?: { value: string } }>;
  };
};

const runGate = (
  observer: unknown,
  definitions: Definition[],
): (() => void) => {
  return () =>
    authenticationGatePlugin.onExecute({
      args: {
        // biome-ignore lint/suspicious/noExplicitAny: minimal fake execution args
        contextValue: { observer } as any,
        document: { definitions },
      },
    });
};

const dataQuery: Definition[] = [
  {
    kind: "OperationDefinition",
    operation: "query",
    name: { value: "GetWorkflows" },
    selectionSet: {
      selections: [{ kind: "Field", name: { value: "workflows" } }],
    },
  },
];

const dataMutation: Definition[] = [
  {
    kind: "OperationDefinition",
    operation: "mutation",
    name: { value: "CreateWorkflow" },
    selectionSet: {
      selections: [{ kind: "Field", name: { value: "createWorkflow" } }],
    },
  },
];

describe("authentication gate fails closed on null observer", () => {
  it("denies a data query when the observer did not resolve", () => {
    // A bogus/expired Bearer token resolves to observer=null; this must throw
    expect(runGate(null, dataQuery)).toThrow(/Authentication required/);
  });

  it("denies a mutation when the observer did not resolve", () => {
    expect(runGate(null, dataMutation)).toThrow(/Authentication required/);
  });

  it("allows a request once the observer is resolved", () => {
    expect(runGate({ id: "u1" }, dataQuery)).not.toThrow();
  });

  it("allows a named IntrospectionQuery without an observer", () => {
    const introspection: Definition[] = [
      {
        kind: "OperationDefinition",
        operation: "query",
        name: { value: "IntrospectionQuery" },
        selectionSet: {
          selections: [{ kind: "Field", name: { value: "__schema" } }],
        },
      },
    ];
    expect(runGate(null, introspection)).not.toThrow();
  });

  it("allows a query selecting only __schema / __type without an observer", () => {
    const schemaOnly: Definition[] = [
      {
        kind: "OperationDefinition",
        operation: "query",
        selectionSet: {
          selections: [{ kind: "Field", name: { value: "__type" } }],
        },
      },
    ];
    expect(runGate(null, schemaOnly)).not.toThrow();
  });
});
