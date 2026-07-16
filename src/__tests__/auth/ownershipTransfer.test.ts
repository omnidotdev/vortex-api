/**
 * Organization ownership transfer tests.
 *
 * Covers the atomic Warden owner-tuple move (`transferOrganizationOwnership`)
 * that is wired into the `member.role_changed` IDP webhook when a member is
 * promoted to `owner`, and asserts the webhook wiring itself.
 */

import { describe, expect, it } from "bun:test";

import { transferOrganizationOwnership } from "lib/warden/organization";

describe("transferOrganizationOwnership", () => {
  it("writes the new owner tuple BEFORE deleting the old one", async () => {
    const calls: string[] = [];

    await transferOrganizationOwnership("org-1", "old-owner", "new-owner", {
      authzApiUrl: "http://warden.test",
      writeTuples: async (_url, tuples) => {
        calls.push(`write:${tuples[0].user}:${tuples[0].relation}`);
      },
      deleteTuples: async (_url, tuples) => {
        calls.push(`delete:${tuples[0].user}:${tuples[0].relation}`);
      },
    });

    // Ordering guarantees an org never has zero owners mid-transfer
    expect(calls).toEqual([
      "write:user:new-owner:owner",
      "delete:user:old-owner:owner",
    ]);
  });

  it("no-ops when authz is disabled (no tuple ops)", async () => {
    let touched = false;

    await transferOrganizationOwnership("org-1", "old-owner", "new-owner", {
      authzApiUrl: "",
      writeTuples: async () => {
        touched = true;
      },
      deleteTuples: async () => {
        touched = true;
      },
    });

    expect(touched).toBe(false);
  });

  it("does not swallow a failed write (fail-closed, old owner retained)", async () => {
    let deleted = false;

    const run = transferOrganizationOwnership(
      "org-1",
      "old-owner",
      "new-owner",
      {
        authzApiUrl: "http://warden.test",
        writeTuples: async () => {
          throw new Error("Warden unreachable");
        },
        deleteTuples: async () => {
          deleted = true;
        },
      },
    );

    await expect(run).rejects.toThrow("Warden unreachable");
    // The old owner must NOT be removed if the new owner write failed
    expect(deleted).toBe(false);
  });
});

describe("member.role_changed webhook ownership wiring", () => {
  it("imports transferOrganizationOwnership", async () => {
    const src = await Bun.file("src/lib/idp/webhooks.ts").text();
    expect(src).toContain("transferOrganizationOwnership");
  });

  it("treats a change to the owner role as a transfer", async () => {
    const src = await Bun.file("src/lib/idp/webhooks.ts").text();
    expect(src).toContain('newRole === "owner"');
    expect(src).toContain("syncOwnershipTransferBestEffort");
  });

  it("removed the @knipignore now that transferOrganizationOwnership is used", async () => {
    const src = await Bun.file("src/lib/warden/organization.ts").text();
    // The doc block for the transfer helper must no longer carry @knipignore
    const transferBlock = src.slice(
      src.indexOf("Transfer organization ownership"),
    );
    expect(transferBlock).not.toContain("@knipignore");
  });
});
