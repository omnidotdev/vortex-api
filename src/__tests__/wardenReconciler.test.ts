/**
 * Warden org-membership reconciler tests.
 *
 * Covers the pure expected-tuple builder and the missing-tuple diff without
 * module mocking. The builder must key tuples on the GATEKEEPER IDP user id
 * (`user:${idpUserId}`), NOT vortex's own local `user_organization.userId`
 * uuid, otherwise the tuples never match the PDP and get rewritten forever.
 */

import { describe, expect, it } from "bun:test";

import {
  expectedTuplesFromMemberships,
  missingTuples,
} from "lib/warden/reconciler";

describe("expectedTuplesFromMemberships", () => {
  it("builds one tuple per membership row keyed on the IDP user id", () => {
    const tuples = expectedTuplesFromMemberships([
      { idpUserId: "idp-abc", role: "owner", organizationId: "org-1" },
    ]);

    expect(tuples).toEqual([
      { user: "user:idp-abc", relation: "owner", object: "organization:org-1" },
    ]);
  });

  it("uses the idp user id, not the local user_organization uuid", () => {
    const localUuid = "00000000-0000-0000-0000-000000000000";
    const idpUserId = "11111111-1111-1111-1111-111111111111";

    const [tuple] = expectedTuplesFromMemberships([
      { idpUserId, role: "member", organizationId: "org-9" },
    ]);

    // Regression guard for the identifier gotcha: the tuple subject must be the
    // IDP id vortex actually writes on, never the local membership-row uuid
    expect(tuple?.user).toBe(`user:${idpUserId}`);
    expect(tuple?.user).not.toBe(`user:${localUuid}`);
  });

  it("emits one tuple per row as-is (matches the manual reconcile script)", () => {
    const tuples = expectedTuplesFromMemberships([
      { idpUserId: "u1", role: "owner", organizationId: "org-1" },
      { idpUserId: "u1", role: "admin", organizationId: "org-1" },
      { idpUserId: "u2", role: "member", organizationId: "org-2" },
    ]);

    expect(tuples).toEqual([
      { user: "user:u1", relation: "owner", object: "organization:org-1" },
      { user: "user:u1", relation: "admin", object: "organization:org-1" },
      { user: "user:u2", relation: "member", object: "organization:org-2" },
    ]);
  });
});

describe("missingTuples", () => {
  it("returns only the expected tuples absent from the actual set", () => {
    const expected = [
      { user: "user:u1", relation: "owner", object: "organization:org-1" },
      { user: "user:u2", relation: "member", object: "organization:org-2" },
    ];
    const actual = [
      { user: "user:u1", relation: "owner", object: "organization:org-1" },
    ];

    expect(missingTuples(expected, actual)).toEqual([
      { user: "user:u2", relation: "member", object: "organization:org-2" },
    ]);
  });

  it("returns an empty array when nothing is missing", () => {
    const tuples = [
      { user: "user:u1", relation: "owner", object: "organization:org-1" },
    ];

    expect(missingTuples(tuples, tuples)).toEqual([]);
  });
});
