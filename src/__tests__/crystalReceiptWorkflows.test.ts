import { describe, expect, it } from "bun:test";

import bountyFunded from "../lib/db/seeds/crystalBountyFunded.workflow.json";
import digitalPurchase from "../lib/db/seeds/crystalDigitalPurchase.workflow.json";
import sponsorshipCreated from "../lib/db/seeds/crystalSponsorshipCreated.workflow.json";
import sponsorshipRenewed from "../lib/db/seeds/crystalSponsorshipRenewed.workflow.json";

type Wf = {
  executor: string;
  steps: Array<Record<string, unknown>>;
};

const stepById = (wf: Wf, id: string) =>
  wf.steps.find((s) => s.id === id) as Record<string, unknown>;

const runBuild = (wf: Wf, data: Record<string, unknown>) => {
  const step = stepById(wf, "build-emails") as { code: { source: string } };
  return new Function("input", step.code.source)({ d: data }) as Record<
    string,
    unknown
  >;
};

const trigger = (wf: Wf) =>
  (stepById(wf, "trigger") as { trigger: { config: { pattern: string; source: string } } })
    .trigger.config;

const condition = (wf: Wf) =>
  (stepById(wf, "check-creator") as { condition: { expression: string } })
    .condition.expression;

describe("crystal receipt workflows", () => {
  it("all are hatchet + omni.crystal with the right event patterns", () => {
    expect((digitalPurchase as Wf).executor).toBe("hatchet");
    expect(trigger(digitalPurchase as Wf).pattern).toBe(
      "crystal.digital_product.purchased",
    );
    expect(trigger(sponsorshipCreated as Wf).pattern).toBe(
      "crystal.sponsorship.created",
    );
    expect(trigger(sponsorshipRenewed as Wf).pattern).toBe(
      "crystal.sponsorship.renewed",
    );
    expect(trigger(bountyFunded as Wf).pattern).toBe("crystal.bounty.funded");
    for (const wf of [digitalPurchase, sponsorshipCreated, sponsorshipRenewed, bountyFunded]) {
      expect(trigger(wf as Wf).source).toBe("omni.crystal");
    }
  });

  it("creator-branch conditions put the comparison OUTSIDE the braces (halo-bug regression)", () => {
    for (const wf of [digitalPurchase, sponsorshipCreated, bountyFunded]) {
      expect(condition(wf as Wf)).toBe(
        "{{steps['build-emails'].output.hasCreatorEmail}} === true",
      );
    }
  });

  it("digital purchase renders buyer receipt (with download) + creator sale notice", () => {
    const out = runBuild(digitalPurchase as Wf, {
      buyerEmail: "b@x.com",
      buyerName: "Grace",
      isAnonymous: false,
      productName: "Synth Pack",
      amount: "$12.00",
      currency: "USD",
      downloadUrl: "https://api.crystal.omni.dev/digital-products/p1/download?token=t",
      creatorName: "Acme",
      creatorEmail: "owner@x.com",
    });
    expect(out.buyerEmail).toBe("b@x.com");
    expect(out.buyerHtml).toContain("Synth Pack");
    expect(out.buyerHtml).toContain("$12.00");
    expect(out.buyerHtml).toContain("download?token=t");
    expect(out.creatorHtml).toContain("Grace");
    expect(out.hasCreatorEmail).toBe(true);
  });

  it("sponsorship created renders sponsor receipt + creator notice with tier + cadence", () => {
    const out = runBuild(sponsorshipCreated as Wf, {
      sponsorEmail: "s@x.com",
      sponsorName: "Kat",
      isAnonymous: false,
      tierName: "Gold",
      amount: "$5.00",
      frequency: "monthly",
      creatorName: "Acme",
      creatorEmail: "owner@x.com",
    });
    expect(out.sponsorHtml).toContain("Acme");
    expect(out.sponsorHtml).toContain("Gold");
    expect(out.sponsorHtml).toContain("$5.00");
    expect(out.creatorHtml).toContain("Kat");
    expect(out.hasCreatorEmail).toBe(true);
  });

  it("sponsorship renewed is sponsor-only (no creator branch)", () => {
    expect(stepById(sponsorshipRenewed as Wf, "check-creator")).toBeUndefined();
    const out = runBuild(sponsorshipRenewed as Wf, {
      sponsorEmail: "s@x.com",
      tierName: "Gold",
      amount: "$5.00",
      creatorName: "Acme",
    });
    expect(out.sponsorEmail).toBe("s@x.com");
    expect(out.sponsorHtml).toContain("renewed");
    expect(out.sponsorHtml).toContain("$5.00");
  });

  it("bounty funded hides an anonymous backer and escapes the message", () => {
    const out = runBuild(bountyFunded as Wf, {
      funderEmail: "f@x.com",
      funderName: "Nope",
      isAnonymous: true,
      bountyTitle: "Fix the bug",
      amount: "$50.00",
      message: "<script>x</script>",
      creatorName: "Acme",
      creatorEmail: "owner@x.com",
    });
    expect(out.funderHtml).toContain("Fix the bug");
    expect(out.creatorHtml).toContain("An anonymous backer");
    expect(out.creatorHtml).not.toContain("Nope");
    expect(out.creatorHtml).not.toContain("<script>");
  });
});
