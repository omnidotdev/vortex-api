/**
 * Workflow Compiler
 *
 * Compiles JSON DSL workflow definitions into executable Temporal workflows.
 * This is the bridge between the declarative JSON format and Temporal's
 * workflow execution engine.
 */

import { ExecutionContext } from "./context";
import { validateWorkflowDefinition } from "./schema";

import type {
  ActionStep,
  ConditionStep,
  DelayStep,
  GateStep,
  LoopStep,
  ParallelStep,
  PluginStep,
  Step,
  SwitchStep,
  WorkflowDefinition,
} from "./types";

export interface CompilerOptions {
  /** Maximum execution time for the workflow */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface CompiledWorkflow {
  /** The original workflow definition */
  definition: WorkflowDefinition;
  /** Execute the workflow with the given input */
  execute(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface StepExecutor {
  action: (
    ctx: ExecutionContext,
    step: ActionStep,
    activities: WorkflowActivities,
  ) => Promise<void>;
  condition: (ctx: ExecutionContext, step: ConditionStep) => Promise<string>;
  switch: (ctx: ExecutionContext, step: SwitchStep) => Promise<string>;
  loop: (
    ctx: ExecutionContext,
    step: LoopStep,
    executeStep: (stepId: string) => Promise<void>,
  ) => Promise<void>;
  gate: (
    ctx: ExecutionContext,
    step: GateStep,
    signals: WorkflowSignals,
  ) => Promise<void>;
  delay: (ctx: ExecutionContext, step: DelayStep) => Promise<void>;
  parallel: (
    ctx: ExecutionContext,
    step: ParallelStep,
    executeStep: (stepId: string) => Promise<void>,
  ) => Promise<void>;
  plugin: (
    ctx: ExecutionContext,
    step: PluginStep,
    activities: WorkflowActivities,
  ) => Promise<void>;
}

export interface WorkflowActivities {
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

export interface WorkflowSignals {
  waitForApproval: (
    stepId: string,
    approvers: string[],
    timeout?: string,
  ) => Promise<boolean>;
  waitForSignal: (signalName: string, timeout?: string) => Promise<unknown>;
}

/**
 * Compile a workflow definition into an executable workflow.
 */
export function compileWorkflow(
  definition: unknown,
  options: CompilerOptions = {},
): CompiledWorkflow {
  // Validate the definition
  const validatedDefinition = validateWorkflowDefinition(definition);

  return {
    definition: validatedDefinition,
    execute: async (input: Record<string, unknown>) => {
      const ctx = new ExecutionContext(validatedDefinition, input);

      // Find the trigger step (entry point)
      const triggerStep = ctx.getTriggerStep();
      if (!triggerStep) {
        throw new Error("No trigger step found in workflow");
      }

      if (options.debug) {
        console.warn(`[Compiler] Starting workflow execution`);
        console.warn(`[Compiler] Trigger step: ${triggerStep.id}`);
      }

      // The actual execution happens in the Temporal workflow
      // This returns the final output
      return ctx.getStepOutputs();
    },
  };
}

/**
 * Build the execution graph from edges.
 * Returns a map of stepId -> next step IDs.
 */
export function buildExecutionGraph(
  definition: WorkflowDefinition,
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  // Initialize with empty arrays
  for (const step of definition.steps) {
    graph.set(step.id, []);
  }

  // Build from edges
  for (const edge of definition.edges) {
    const current = graph.get(edge.source) || [];
    current.push(edge.target);
    graph.set(edge.source, current);
  }

  // Also include explicit next references from steps
  for (const step of definition.steps) {
    if (step.next) {
      const current = graph.get(step.id) || [];
      const nextSteps = Array.isArray(step.next) ? step.next : [step.next];
      for (const next of nextSteps) {
        if (!current.includes(next)) {
          current.push(next);
        }
      }
      graph.set(step.id, current);
    }
  }

  return graph;
}

/**
 * Topological sort of steps for execution order.
 */
export function getExecutionOrder(definition: WorkflowDefinition): string[] {
  const graph = buildExecutionGraph(definition);
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(stepId: string) {
    if (visited.has(stepId)) return;
    visited.add(stepId);

    const nextSteps = graph.get(stepId) || [];
    for (const next of nextSteps) {
      visit(next);
    }

    order.unshift(stepId);
  }

  // Start from trigger
  const trigger = definition.steps.find((s) => s.type === "trigger");
  if (trigger) {
    visit(trigger.id);
  }

  return order;
}

/**
 * Find all step IDs that should be executed after a given step.
 */
export function getNextSteps(
  step: Step,
  definition: WorkflowDefinition,
): string[] {
  // Check explicit next
  if (step.next) {
    return Array.isArray(step.next) ? step.next : [step.next];
  }

  // Check edges
  const nextFromEdges = definition.edges
    .filter((e) => e.source === step.id)
    .map((e) => e.target);

  return nextFromEdges;
}

/**
 * Validate that all referenced steps exist.
 */
export function validateStepReferences(
  definition: WorkflowDefinition,
): string[] {
  const errors: string[] = [];
  const stepIds = new Set(definition.steps.map((s) => s.id));

  for (const step of definition.steps) {
    // Check next references
    if (step.next) {
      const nextSteps = Array.isArray(step.next) ? step.next : [step.next];
      for (const next of nextSteps) {
        if (!stepIds.has(next)) {
          errors.push(
            `Step "${step.id}" references non-existent step "${next}"`,
          );
        }
      }
    }

    // Check type-specific references
    if (step.type === "condition") {
      if (!stepIds.has(step.condition.trueBranch)) {
        errors.push(
          `Condition step "${step.id}" references non-existent trueBranch "${step.condition.trueBranch}"`,
        );
      }
      if (!stepIds.has(step.condition.falseBranch)) {
        errors.push(
          `Condition step "${step.id}" references non-existent falseBranch "${step.condition.falseBranch}"`,
        );
      }
    }

    if (step.type === "switch") {
      for (const c of step.switch.cases) {
        if (!stepIds.has(c.next)) {
          errors.push(
            `Switch step "${step.id}" case "${c.label}" references non-existent step "${c.next}"`,
          );
        }
      }
      if (step.switch.default && !stepIds.has(step.switch.default)) {
        errors.push(
          `Switch step "${step.id}" default references non-existent step "${step.switch.default}"`,
        );
      }
    }

    if (step.type === "loop") {
      for (const bodyStep of step.loop.body) {
        if (!stepIds.has(bodyStep)) {
          errors.push(
            `Loop step "${step.id}" body references non-existent step "${bodyStep}"`,
          );
        }
      }
    }

    if (step.type === "parallel") {
      for (const branch of step.parallel.branches) {
        for (const branchStep of branch) {
          if (!stepIds.has(branchStep)) {
            errors.push(
              `Parallel step "${step.id}" branch references non-existent step "${branchStep}"`,
            );
          }
        }
      }
    }
  }

  // Check edge references
  for (const edge of definition.edges) {
    if (!stepIds.has(edge.source)) {
      errors.push(
        `Edge "${edge.id}" source references non-existent step "${edge.source}"`,
      );
    }
    if (!stepIds.has(edge.target)) {
      errors.push(
        `Edge "${edge.id}" target references non-existent step "${edge.target}"`,
      );
    }
  }

  return errors;
}

/**
 * Detect cycles in the workflow graph.
 */
export function detectCycles(definition: WorkflowDefinition): string[][] {
  const graph = buildExecutionGraph(definition);
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(stepId: string): boolean {
    visited.add(stepId);
    recursionStack.add(stepId);
    path.push(stepId);

    const neighbors = graph.get(stepId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
      }
    }

    path.pop();
    recursionStack.delete(stepId);
    return false;
  }

  for (const step of definition.steps) {
    if (!visited.has(step.id)) {
      dfs(step.id);
    }
  }

  return cycles;
}
