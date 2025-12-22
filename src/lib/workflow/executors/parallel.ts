/**
 * Parallel Step Executor
 *
 * Executes multiple branches concurrently.
 */

import type { ExecutionContext } from "../context";
import type { ParallelStep } from "../types";

/**
 * Execute a parallel step.
 */
export async function executeParallel(
  ctx: ExecutionContext,
  step: ParallelStep,
  executeSteps: (stepIds: string[]) => Promise<void>,
): Promise<void> {
  const { parallel } = step;
  const { branches, waitFor } = parallel;

  const branchPromises = branches.map(async (branchSteps, index) => {
    try {
      await executeSteps(branchSteps);
      return {
        index,
        success: true,
        results: branchSteps.reduce(
          (acc, stepId) => {
            acc[stepId] = ctx.getStepOutput(stepId);
            return acc;
          },
          {} as Record<string, unknown>,
        ),
      };
    } catch (error) {
      return {
        index,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  let results: Array<{
    index: number;
    success: boolean;
    results?: Record<string, unknown>;
    error?: string;
  }>;

  if (waitFor === "all") {
    // Wait for all branches to complete
    results = await Promise.all(branchPromises);
  } else if (waitFor === "any") {
    // Wait for the first branch to complete
    const first = await Promise.race(branchPromises);
    results = [first];

    // Let other branches complete in background (don't await)
    Promise.allSettled(branchPromises);
  } else if (typeof waitFor === "number") {
    // Wait for N branches to complete
    results = [];
    const pending = [...branchPromises];

    while (results.length < waitFor && pending.length > 0) {
      const completed = await Promise.race(
        pending.map(async (p, i) => ({ result: await p, pendingIndex: i })),
      );
      results.push(completed.result);
      pending.splice(completed.pendingIndex, 1);
    }

    // Let remaining branches complete in background
    Promise.allSettled(pending);
  } else {
    results = await Promise.all(branchPromises);
  }

  // Check for failures
  const failures = results.filter((r) => !r.success);
  const successes = results.filter((r) => r.success);

  ctx.setStepOutput(step.id, {
    totalBranches: branches.length,
    completedBranches: results.length,
    successfulBranches: successes.length,
    failedBranches: failures.length,
    results: results.map((r) => ({
      branchIndex: r.index,
      success: r.success,
      results: r.results,
      error: r.error,
    })),
  });

  // If all branches failed, throw an error
  if (successes.length === 0 && failures.length > 0) {
    throw new Error(
      `All branches in parallel step "${step.id}" failed: ${failures.map((f) => f.error).join(", ")}`,
    );
  }
}
