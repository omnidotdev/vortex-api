/**
 * Per-workflow ACL (workflow_permission) enforcement tests.
 *
 * Covers:
 *  - `hasWorkflowGrant` role semantics (editor is a superset of viewer)
 *  - `canMutateWorkflow` combined decision used by the workflow update/delete
 *    authorization plugin, proving the rule is (org admin) OR (editor grant):
 *      1. org admin can still update/delete (unchanged)
 *      2. a non-admin member WITH an editor grant can now update/delete
 *      3. a non-admin member WITHOUT a grant still cannot
 *      4. a viewer grant does NOT permit update/delete
 */

import { describe, expect, it } from "bun:test";

import { canMutateWorkflow } from "lib/graphql/plugins/authorization/Workflow.plugin";
import hasWorkflowGrant from "lib/warden/workflowGrant";

import type authorize from "lib/warden/authorize";

const WORKFLOW = { id: "wf-1", organizationId: "org-1" };

/** Build an `authorize` stub that returns a fixed decision. */
const fakeAuthorize =
  (decision: boolean): typeof authorize =>
  async () =>
    decision;

/** Build a `hasWorkflowGrant` stub honoring editor>viewer semantics. */
const fakeGrant =
  (held: "viewer" | "editor" | null): typeof hasWorkflowGrant =>
  async (_idpUserId, _workflowId, minRole) => {
    if (!held) return false;
    if (minRole === "viewer") return held === "viewer" || held === "editor";
    return held === "editor";
  };

describe("hasWorkflowGrant role semantics", () => {
  it("returns false when the IDP user has no local Vortex user", async () => {
    const result = await hasWorkflowGrant("idp-1", "wf-1", "editor", {
      resolveVortexUserId: async () => null,
      fetchGrant: async () => "editor",
    });
    expect(result).toBe(false);
  });

  it("returns false when the user holds no grant", async () => {
    const result = await hasWorkflowGrant("idp-1", "wf-1", "viewer", {
      resolveVortexUserId: async () => "user-1",
      fetchGrant: async () => null,
    });
    expect(result).toBe(false);
  });

  it("editor grant satisfies both editor and viewer", async () => {
    const deps = {
      resolveVortexUserId: async () => "user-1",
      fetchGrant: async () => "editor" as const,
    };
    expect(await hasWorkflowGrant("idp-1", "wf-1", "editor", deps)).toBe(true);
    expect(await hasWorkflowGrant("idp-1", "wf-1", "viewer", deps)).toBe(true);
  });

  it("viewer grant satisfies viewer only, not editor", async () => {
    const deps = {
      resolveVortexUserId: async () => "user-1",
      fetchGrant: async () => "viewer" as const,
    };
    expect(await hasWorkflowGrant("idp-1", "wf-1", "viewer", deps)).toBe(true);
    expect(await hasWorkflowGrant("idp-1", "wf-1", "editor", deps)).toBe(false);
  });
});

describe("canMutateWorkflow decision (update/delete)", () => {
  it("1. org admin can still update/delete (unchanged)", async () => {
    const allowed = await canMutateWorkflow("idp-admin", WORKFLOW, {
      authorize: fakeAuthorize(true),
      // Grant check must never be reached for an admin, but if it were it
      // would deny; the admin short-circuit is what allows the mutation
      hasWorkflowGrant: fakeGrant(null),
    });
    expect(allowed).toBe(true);
  });

  it("2. non-admin member WITH an editor grant can now update/delete", async () => {
    const allowed = await canMutateWorkflow("idp-editor", WORKFLOW, {
      authorize: fakeAuthorize(false),
      hasWorkflowGrant: fakeGrant("editor"),
    });
    expect(allowed).toBe(true);
  });

  it("3. non-admin member WITHOUT a grant still cannot", async () => {
    const allowed = await canMutateWorkflow("idp-member", WORKFLOW, {
      authorize: fakeAuthorize(false),
      hasWorkflowGrant: fakeGrant(null),
    });
    expect(allowed).toBe(false);
  });

  it("4. a viewer grant does NOT permit update/delete", async () => {
    const allowed = await canMutateWorkflow("idp-viewer", WORKFLOW, {
      authorize: fakeAuthorize(false),
      hasWorkflowGrant: fakeGrant("viewer"),
    });
    expect(allowed).toBe(false);
  });

  it("denies when Warden denies admin and no grant is held (fail-closed)", async () => {
    const allowed = await canMutateWorkflow("idp-x", WORKFLOW, {
      authorize: fakeAuthorize(false),
      hasWorkflowGrant: fakeGrant(null),
    });
    expect(allowed).toBe(false);
  });
});
