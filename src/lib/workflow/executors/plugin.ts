/**
 * Plugin Step Executor
 *
 * Executes Extism WASM plugins.
 */

import type { ExecutionContext } from "../context";
import type { PluginStep } from "../types";

export interface PluginActivities {
  executePlugin: (
    pluginId: string,
    functionName: string,
    inputs: Record<string, unknown>,
    options?: { timeout?: number; memoryLimit?: number },
  ) => Promise<unknown>;
}

/**
 * Execute a plugin step.
 */
export async function executePlugin(
  ctx: ExecutionContext,
  step: PluginStep,
  activities: PluginActivities,
): Promise<void> {
  const { plugin } = step;

  // Resolve input expressions
  const resolvedInputs = ctx.resolveInputs(plugin.inputs);

  // Execute the plugin
  const result = await activities.executePlugin(
    plugin.pluginId,
    plugin.function,
    resolvedInputs,
    {
      timeout: plugin.timeout,
      memoryLimit: plugin.memoryLimit,
    },
  );

  // Store the result
  ctx.setStepOutput(step.id, result);

  // Map outputs to variables if specified
  if (plugin.outputs) {
    for (const [varName, path] of Object.entries(plugin.outputs)) {
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
