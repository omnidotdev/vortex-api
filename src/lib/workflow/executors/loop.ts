/**
 * Loop Step Executor
 *
 * Executes loop iterations (forEach, while, times).
 */

import type { ExecutionContext } from "../context";
import type { LoopStep } from "../types";

const DEFAULT_MAX_ITERATIONS = 1000;

/**
 * Execute a loop step.
 */
export async function executeLoop(
  ctx: ExecutionContext,
  step: LoopStep,
  executeSteps: (stepIds: string[]) => Promise<void>,
): Promise<void> {
  const { loop } = step;
  const maxIterations = loop.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const results: unknown[] = [];
  let iterations = 0;

  switch (loop.type) {
    case "forEach": {
      if (!loop.collection) {
        throw new Error(`Loop step "${step.id}" forEach requires a collection`);
      }

      const collection = ctx.evaluateExpression(loop.collection);
      if (!Array.isArray(collection)) {
        throw new Error(
          `Loop step "${step.id}" collection must evaluate to an array`,
        );
      }

      for (let i = 0; i < collection.length && i < maxIterations; i++) {
        const item = collection[i];

        // Set loop variables
        if (loop.itemVariable) {
          ctx.setVariable(loop.itemVariable, item);
        }
        if (loop.indexVariable) {
          ctx.setVariable(loop.indexVariable, i);
        }

        // Execute body steps
        await executeSteps(loop.body);
        iterations++;

        // Collect results from body execution
        const bodyResults: Record<string, unknown> = {};
        for (const stepId of loop.body) {
          bodyResults[stepId] = ctx.getStepOutput(stepId);
        }
        results.push(bodyResults);
      }
      break;
    }

    case "while": {
      if (!loop.condition) {
        throw new Error(`Loop step "${step.id}" while requires a condition`);
      }

      while (iterations < maxIterations) {
        const shouldContinue = ctx.evaluateExpression(loop.condition);
        if (!shouldContinue) break;

        // Set index variable
        if (loop.indexVariable) {
          ctx.setVariable(loop.indexVariable, iterations);
        }

        // Execute body steps
        await executeSteps(loop.body);
        iterations++;

        // Collect results
        const bodyResults: Record<string, unknown> = {};
        for (const stepId of loop.body) {
          bodyResults[stepId] = ctx.getStepOutput(stepId);
        }
        results.push(bodyResults);
      }
      break;
    }

    case "times": {
      const count = loop.count ?? 1;
      const actualCount = Math.min(count, maxIterations);

      for (let i = 0; i < actualCount; i++) {
        // Set index variable
        if (loop.indexVariable) {
          ctx.setVariable(loop.indexVariable, i);
        }

        // Execute body steps
        await executeSteps(loop.body);
        iterations++;

        // Collect results
        const bodyResults: Record<string, unknown> = {};
        for (const stepId of loop.body) {
          bodyResults[stepId] = ctx.getStepOutput(stepId);
        }
        results.push(bodyResults);
      }
      break;
    }
  }

  // Store loop results
  ctx.setStepOutput(step.id, {
    iterations,
    results,
  });
}
