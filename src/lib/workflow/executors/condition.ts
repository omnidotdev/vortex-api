/**
 * Condition Step Executor
 *
 * Evaluates a condition and returns the next step ID.
 */

import type { ExecutionContext } from "../context";
import type { ConditionStep } from "../types";

/**
 * Execute a condition step and return the next step ID.
 */
export async function executeCondition(
  ctx: ExecutionContext,
  step: ConditionStep,
): Promise<string> {
  const { condition } = step;

  // Evaluate the expression
  const result = ctx.evaluateExpression(condition.expression);

  // Store the result
  ctx.setStepOutput(step.id, { result, branch: result ? "true" : "false" });

  // Return the appropriate branch
  return result ? condition.trueBranch : condition.falseBranch;
}
