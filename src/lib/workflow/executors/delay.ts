/**
 * Delay Step Executor
 *
 * Pauses workflow execution for a specified duration.
 */

import { ExecutionContext } from "../context";

import type { DelayStep } from "../types";

export interface DelayFunctions {
  sleep: (ms: number) => Promise<void>;
}

/**
 * Execute a delay step.
 */
export async function executeDelay(
  ctx: ExecutionContext,
  step: DelayStep,
  delayFn: DelayFunctions,
): Promise<void> {
  const { delay } = step;

  const ms = ExecutionContext.durationToMs(delay.duration, delay.unit);

  const startedAt = new Date().toISOString();

  await delayFn.sleep(ms);

  const completedAt = new Date().toISOString();

  ctx.setStepOutput(step.id, {
    duration: delay.duration,
    unit: delay.unit,
    durationMs: ms,
    startedAt,
    completedAt,
  });
}
