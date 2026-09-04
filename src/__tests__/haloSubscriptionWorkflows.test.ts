import { describe, expect, it } from "bun:test";

import canceled from "../lib/db/seeds/haloSubscriptionCanceled.workflow.json";
import paymentFailed from "../lib/db/seeds/haloSubscriptionPaymentFailed.workflow.json";

type Wf = { executor: string; steps: Array<Record<string, unknown>> };

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
  (
    stepById(wf, "trigger") as {
      trigger: { config: { pattern: string; source: string } };
    }
  ).trigger.config;

describe("halo subscription lifecycle workflows", () => {
  it("target the right events on omni.halo, hatchet", () => {
    expect((paymentFailed as Wf).executor).toBe("hatchet");
    expect(trigger(paymentFailed as Wf).pattern).toBe(
      "halo.subscription.payment_failed",
    );
    expect(trigger(canceled as Wf).pattern).toBe("halo.subscription.canceled");
    expect(trigger(paymentFailed as Wf).source).toBe("omni.halo");
    expect(trigger(canceled as Wf).source).toBe("omni.halo");
  });

  it("payment-failed is an action-required buyer notice with store + amount", () => {
    const out = runBuild(paymentFailed as Wf, {
      subscriptionId: "s1",
      buyerEmail: "b@x.com",
      storeName: "Acme Store",
      amount: "$9.00",
      currency: "USD",
    });
    expect(out.buyerEmail).toBe("b@x.com");
    expect(out.buyerSubject).toContain("Action required");
    expect(out.buyerHtml).toContain("Acme Store");
    expect(out.buyerHtml).toContain("$9.00");
  });

  it("canceled is a buyer confirmation naming the store", () => {
    const out = runBuild(canceled as Wf, {
      subscriptionId: "s1",
      buyerEmail: "b@x.com",
      storeName: "Acme Store",
    });
    expect(out.buyerEmail).toBe("b@x.com");
    expect(out.buyerHtml).toContain("canceled");
    expect(out.buyerHtml).toContain("Acme Store");
  });
});
