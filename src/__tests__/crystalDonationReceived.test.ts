import { describe, expect, it } from "bun:test";

import template from "../lib/db/seeds/crystalDonationReceived.workflow.json";

const stepById = (id: string) =>
  template.steps.find((s) => s.id === id) as Record<string, unknown>;

/** Run the build-emails code step against a sample event payload. */
const runBuildEmails = (data: Record<string, unknown>) => {
  const step = stepById("build-emails") as { code: { source: string } };
  const fn = new Function("input", `${step.code.source}`);
  return fn({ d: data }) as {
    donorEmail: string;
    donorSubject: string;
    donorHtml: string;
    creatorEmail: string;
    creatorSubject: string;
    creatorHtml: string;
    hasCreatorEmail: boolean;
  };
};

describe("crystal-donation-received workflow", () => {
  it("triggers on crystal.donation.received from omni.crystal, hatchet executor", () => {
    const trigger = stepById("trigger") as {
      trigger: { config: { pattern: string; source: string } };
    };
    expect(trigger.trigger.config.pattern).toBe("crystal.donation.received");
    expect(trigger.trigger.config.source).toBe("omni.crystal");
    expect((template as { executor: string }).executor).toBe("hatchet");
  });

  it("gates the creator branch with the comparison OUTSIDE the braces (halo-bug regression)", () => {
    const cond = stepById("check-creator") as {
      condition: { expression: string };
    };
    // The DSL executor treats everything between {{ }} as a single path, so the
    // comparison must sit outside the braces or the branch is always false.
    expect(cond.condition.expression).toBe(
      "{{steps['build-emails'].output.hasCreatorEmail}} === true",
    );
    expect(cond.condition.expression).not.toContain("=== true }}");
  });

  it("renders a donor receipt and a creator notification with amount + creator name", () => {
    const out = runBuildEmails({
      donorEmail: "donor@example.com",
      donorName: "Ada Lovelace",
      isAnonymous: false,
      creatorName: "Acme Collective",
      creatorEmail: "owner@example.com",
      amount: "$25.00",
      currency: "USD",
      message: "Keep it up!",
    });
    expect(out.donorEmail).toBe("donor@example.com");
    expect(out.donorHtml).toContain("$25.00");
    expect(out.donorHtml).toContain("Acme Collective");
    expect(out.donorHtml.toLowerCase()).toContain("receipt");
    expect(out.creatorEmail).toBe("owner@example.com");
    expect(out.creatorHtml).toContain("Ada Lovelace");
    expect(out.creatorHtml).toContain("$25.00");
    expect(out.hasCreatorEmail).toBe(true);
    // message echoed and HTML-escaped path exercised
    expect(out.donorHtml).toContain("Keep it up!");
  });

  it("hides the donor identity from the creator when anonymous", () => {
    const out = runBuildEmails({
      donorEmail: "donor@example.com",
      donorName: "Ada Lovelace",
      isAnonymous: true,
      creatorName: "Acme Collective",
      creatorEmail: "owner@example.com",
      amount: "$10.00",
    });
    expect(out.creatorHtml).toContain("An anonymous supporter");
    expect(out.creatorHtml).not.toContain("Ada Lovelace");
  });

  it("skips the creator branch when no creator email resolved", () => {
    const out = runBuildEmails({
      donorEmail: "donor@example.com",
      creatorName: "Acme Collective",
      creatorEmail: "",
      amount: "$5.00",
    });
    expect(out.hasCreatorEmail).toBe(false);
  });

  it("escapes HTML in donor-controlled fields", () => {
    const out = runBuildEmails({
      donorEmail: "donor@example.com",
      donorName: "<script>x</script>",
      isAnonymous: false,
      creatorName: "Acme",
      creatorEmail: "owner@example.com",
      amount: "$1.00",
      message: "<img src=x onerror=alert(1)>",
    });
    expect(out.creatorHtml).not.toContain("<script>");
    expect(out.donorHtml).not.toContain("<img src=x");
    expect(out.donorHtml).toContain("&lt;img");
  });
});
