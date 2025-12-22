/**
 * Switch Step Executor
 *
 * Evaluates a switch expression and returns the matching case's next step ID.
 */

import type { ExecutionContext } from "../context";
import type { SwitchStep } from "../types";

/**
 * Execute a switch step and return the next step ID.
 */
export async function executeSwitch(
  ctx: ExecutionContext,
  step: SwitchStep,
): Promise<string> {
  const { switch: switchConfig } = step;

  // Evaluate the expression
  const result = ctx.evaluateExpression(switchConfig.expression);

  // Find matching case
  const matchingCase = switchConfig.cases.find((c) => c.value === result);

  // Store the result
  ctx.setStepOutput(step.id, {
    result,
    matchedCase: matchingCase?.label ?? "default",
  });

  // Return the matching case or default
  if (matchingCase) {
    return matchingCase.next;
  }

  if (switchConfig.default) {
    return switchConfig.default;
  }

  throw new Error(
    `Switch step "${step.id}" has no matching case for value "${result}" and no default`,
  );
}
