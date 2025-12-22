/**
 * Action Step Executor
 *
 * Executes integration or plugin actions.
 */

import type { ExecutionContext } from "../context";
import type { ActionStep } from "../types";

export interface ActionActivities {
  executeIntegrationAction: (
    integrationId: string,
    operation: string,
    inputs: Record<string, unknown>,
  ) => Promise<unknown>;
  executePluginAction: (
    pluginId: string,
    functionName: string,
    inputs: Record<string, unknown>,
  ) => Promise<unknown>;
}

/**
 * Execute an action step.
 */
export async function executeAction(
  ctx: ExecutionContext,
  step: ActionStep,
  activities: ActionActivities,
): Promise<void> {
  const { action } = step;

  // Resolve input expressions
  const resolvedInputs = ctx.resolveInputs(action.inputs);

  let result: unknown;

  if (action.integrationId) {
    // Execute integration action
    result = await activities.executeIntegrationAction(
      action.integrationId,
      action.operation,
      resolvedInputs,
    );
  } else if (action.pluginId) {
    // Execute plugin action
    result = await activities.executePluginAction(
      action.pluginId,
      action.operation,
      resolvedInputs,
    );
  } else {
    throw new Error(
      `Action step "${step.id}" must have either integrationId or pluginId`,
    );
  }

  // Store the result
  ctx.setStepOutput(step.id, result);

  // Map outputs to variables if specified
  if (action.outputs) {
    for (const [varName, path] of Object.entries(action.outputs)) {
      const value = getValueByPath(result, path);
      ctx.setVariable(varName, value);
    }
  }
}

/**
 * Get a value from an object by dot-notation path.
 */
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
