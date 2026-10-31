/**
 * Self-host (single-owner) mode.
 *
 * When `SELF_HOST_MODE=true`, Vortex runs for a single operator who owns
 * everything: there is no external Gatekeeper to verify tokens against and no
 * Warden PDP to consult, so authentication resolves to a fixed owner principal
 * and authorization grants. This mode is mutually exclusive with a configured
 * PDP (`AUTHZ_API_URL`) so it can never silently activate in the multi-tenant
 * hosted deploy, where an unconfigured PDP must keep failing closed.
 */

import { describe, expect, it } from "bun:test";

import resolveAuth from "lib/auth/resolveAuth";
import {
  SELF_HOST_ORG_ID,
  SELF_HOST_OWNER_IDP_ID,
  SELF_HOST_OWNER_USER_ID,
  assertSelfHostAuthzExclusive,
} from "lib/config/env.config";
import authorize from "lib/warden/authorize";

describe("authorize in self-host mode", () => {
  it("grants even when no PDP is configured", async () => {
    const allowed = await authorize(
      "owner",
      "organization",
      "self-host",
      "admin",
      {
        authzApiUrl: undefined,
        isSelfHost: true,
      },
    );
    expect(allowed).toBe(true);
  });

  it("still fails closed when not in self-host mode and no PDP is configured", async () => {
    const allowed = await authorize("u", "organization", "o", "admin", {
      authzApiUrl: undefined,
      isSelfHost: false,
    });
    expect(allowed).toBe(false);
  });
});

describe("resolveAuth in self-host mode", () => {
  it("returns the single owner principal without consulting validators", async () => {
    let validatorCalled = false;
    const mark = async () => {
      validatorCalled = true;
      return null;
    };

    const info = await resolveAuth(undefined, undefined, {
      isSelfHost: true,
      validateApiKey: mark,
      validateSession: mark,
    });

    expect(validatorCalled).toBe(false);
    expect(info).toEqual({
      organizationId: SELF_HOST_ORG_ID,
      userId: SELF_HOST_OWNER_USER_ID,
      idpUserId: SELF_HOST_OWNER_IDP_ID,
      name: "owner",
    });
  });

  it("delegates to the validators when not in self-host mode", async () => {
    let apiKeyCalled = false;
    const info = await resolveAuth("Bearer x", undefined, {
      isSelfHost: false,
      validateApiKey: async () => {
        apiKeyCalled = true;
        return null;
      },
      validateSession: async () => null,
    });

    expect(apiKeyCalled).toBe(true);
    expect(info).toBeNull();
  });
});

describe("self-host / PDP mutual exclusion", () => {
  it("throws when self-host mode and a PDP URL are both configured", () => {
    expect(() =>
      assertSelfHostAuthzExclusive(true, "http://warden.internal"),
    ).toThrow();
  });

  it("allows self-host mode with no PDP configured", () => {
    expect(() => assertSelfHostAuthzExclusive(true, undefined)).not.toThrow();
  });

  it("allows a configured PDP when self-host mode is off", () => {
    expect(() =>
      assertSelfHostAuthzExclusive(false, "http://warden.internal"),
    ).not.toThrow();
  });
});
