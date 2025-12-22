/**
 * Gate Step Executor
 *
 * Waits for human approval or external signals.
 */

import type { ExecutionContext } from "../context";
import type { GateStep } from "../types";

export interface GateSignals {
  waitForApproval: (
    stepId: string,
    approvers: string[],
    timeout?: string,
  ) => Promise<{ approved: boolean; approvedBy?: string }>;
  waitForSignal: (signalName: string, timeout?: string) => Promise<unknown>;
}

/**
 * Execute a gate step.
 */
export async function executeGate(
  ctx: ExecutionContext,
  step: GateStep,
  signals: GateSignals,
): Promise<void> {
  const { gate } = step;

  switch (gate.type) {
    case "approval": {
      const approvers = gate.approvers ?? [];

      const result = await signals.waitForApproval(
        step.id,
        approvers,
        gate.timeout,
      );

      if (!result.approved) {
        // Handle timeout
        switch (gate.timeoutAction) {
          case "approve":
            ctx.setStepOutput(step.id, {
              approved: true,
              auto: true,
              reason: "timeout_auto_approve",
            });
            break;
          case "reject":
            throw new Error(`Gate step "${step.id}" approval timed out`);
          case "continue":
          default:
            ctx.setStepOutput(step.id, {
              approved: false,
              reason: "timeout",
            });
        }
      } else {
        ctx.setStepOutput(step.id, {
          approved: true,
          approvedBy: result.approvedBy,
        });
      }
      break;
    }

    case "signal": {
      if (!gate.signalName) {
        throw new Error(`Gate step "${step.id}" signal requires a signalName`);
      }

      const signalData = await signals.waitForSignal(
        gate.signalName,
        gate.timeout,
      );

      ctx.setStepOutput(step.id, {
        signalReceived: true,
        data: signalData,
      });
      break;
    }
  }
}
