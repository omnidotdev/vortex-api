/**
 * Workflow Execution Context
 *
 * Manages state during workflow execution including variables,
 * step outputs, and expression evaluation.
 */

import type { Step, WorkflowDefinition } from "./types";

/**
 * Execution context for a running workflow.
 */
export class ExecutionContext {
  /** User-defined and computed variables */
  private variables: Record<string, unknown> = {};

  /** Step outputs indexed by step ID */
  private stepOutputs: Record<string, unknown> = {};

  /** Trigger input data */
  private triggerData: Record<string, unknown> = {};

  /** The workflow definition being executed */
  private definition: WorkflowDefinition;

  constructor(
    definition: WorkflowDefinition,
    triggerInput: Record<string, unknown>,
  ) {
    this.definition = definition;
    this.triggerData = triggerInput;

    // Initialize variables with defaults
    if (definition.variables) {
      for (const [key, varDef] of Object.entries(definition.variables)) {
        if (varDef.default !== undefined) {
          this.variables[key] = varDef.default;
        }
      }
    }
  }

  /**
   * Get a step by ID from the workflow definition.
   */
  getStep(stepId: string): Step | undefined {
    return this.definition.steps.find((s) => s.id === stepId);
  }

  /**
   * Get the trigger step from the workflow.
   */
  getTriggerStep(): Step | undefined {
    return this.definition.steps.find((s) => s.type === "trigger");
  }

  /**
   * Get a variable value.
   */
  getVariable(name: string): unknown {
    return this.variables[name];
  }

  /**
   * Set a variable value.
   */
  setVariable(name: string, value: unknown): void {
    this.variables[name] = value;
  }

  /**
   * Get all variables.
   */
  getVariables(): Record<string, unknown> {
    return { ...this.variables };
  }

  /**
   * Get the output of a step.
   */
  getStepOutput(stepId: string): unknown {
    return this.stepOutputs[stepId];
  }

  /**
   * Set the output of a step.
   */
  setStepOutput(stepId: string, output: unknown): void {
    this.stepOutputs[stepId] = output;
  }

  /**
   * Get all step outputs.
   */
  getStepOutputs(): Record<string, unknown> {
    return { ...this.stepOutputs };
  }

  /**
   * Get trigger data.
   */
  getTriggerData(): Record<string, unknown> {
    return { ...this.triggerData };
  }

  /**
   * Build the context object for expression evaluation.
   */
  buildExpressionContext(): Record<string, unknown> {
    return {
      trigger: this.triggerData,
      steps: this.stepOutputs,
      vars: this.variables,
      // Helper functions available in expressions
      $: {
        now: () => new Date().toISOString(),
        uuid: () => crypto.randomUUID(),
        json: (value: unknown) => JSON.stringify(value),
        parse: (value: string) => JSON.parse(value),
      },
    };
  }

  /**
   * Evaluate an expression in the current context.
   *
   * Expressions can reference:
   * - $.trigger.* - Trigger input data
   * - $.steps.<stepId>.* - Output from a specific step
   * - $.vars.* - Variables
   *
   * @param expression - The expression to evaluate
   * @returns The evaluated result
   */
  evaluateExpression(expression: string): unknown {
    // Handle simple property path expressions ($.trigger.body.email)
    if (expression.startsWith("$.")) {
      return this.evaluatePathExpression(expression);
    }

    // For complex expressions, use safe evaluation
    const ctx = this.buildExpressionContext();

    // Create a sandboxed function to evaluate the expression
    // Note: In production, consider using a proper expression parser
    // like expr-eval or jexl for security
    try {
      const fn = new Function(
        "trigger",
        "steps",
        "vars",
        "$",
        `"use strict"; return (${expression});`,
      );
      return fn(ctx.trigger, ctx.steps, ctx.vars, ctx.$);
    } catch (error) {
      throw new Error(
        `Failed to evaluate expression: ${expression}. Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Evaluate a path expression like $.trigger.body.email
   */
  private evaluatePathExpression(path: string): unknown {
    // Remove the $. prefix
    const cleanPath = path.slice(2);
    const parts = cleanPath.split(".");

    const ctx = this.buildExpressionContext();
    let current: unknown = ctx;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current !== "object") {
        return undefined;
      }

      // Handle array indexing: items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        const obj = current as Record<string, unknown>;
        const arr = obj[key];
        if (Array.isArray(arr)) {
          current = arr[parseInt(indexStr, 10)];
        } else {
          return undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return current;
  }

  /**
   * Resolve inputs by evaluating any expressions.
   */
  resolveInputs(inputs: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(inputs)) {
      resolved[key] = this.resolveValue(value);
    }

    return resolved;
  }

  /**
   * Resolve a single value, evaluating expressions if needed.
   */
  private resolveValue(value: unknown): unknown {
    if (typeof value === "string") {
      // Check if it's an expression (starts with $.)
      if (value.startsWith("$.")) {
        return this.evaluateExpression(value);
      }

      // Check for template expressions: "Hello ${$.trigger.name}"
      const templateRegex = /\$\{([^}]+)\}/g;
      if (templateRegex.test(value)) {
        return value.replace(templateRegex, (_, expr) => {
          const result = this.evaluateExpression(expr.trim());
          return result === undefined ? "" : String(result);
        });
      }

      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.resolveValue(v));
    }

    if (value !== null && typeof value === "object") {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.resolveValue(v);
      }
      return resolved;
    }

    return value;
  }

  /**
   * Convert duration to milliseconds.
   */
  static durationToMs(duration: number, unit: string): number {
    switch (unit) {
      case "seconds":
        return duration * 1000;
      case "minutes":
        return duration * 60 * 1000;
      case "hours":
        return duration * 60 * 60 * 1000;
      case "days":
        return duration * 24 * 60 * 60 * 1000;
      default:
        return duration * 1000;
    }
  }
}
