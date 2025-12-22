/**
 * Vortex Workflow JSON DSL Types
 *
 * This file defines the TypeScript types for the Vortex workflow definition language.
 * Workflows are JSON documents that define automation sequences.
 */

// Step types
export const StepType = {
  TRIGGER: "trigger",
  ACTION: "action",
  CONDITION: "condition",
  SWITCH: "switch",
  LOOP: "loop",
  GATE: "gate",
  DELAY: "delay",
  PARALLEL: "parallel",
  PLUGIN: "plugin",
} as const;

export type StepTypeValue = (typeof StepType)[keyof typeof StepType];

// Trigger types
export const TriggerType = {
  WEBHOOK: "webhook",
  CRON: "cron",
  EVENT: "event",
  MANUAL: "manual",
} as const;

export type TriggerTypeValue = (typeof TriggerType)[keyof typeof TriggerType];

// Position for ReactFlow visualization
export interface Position {
  x: number;
  y: number;
}

// Error handling configuration
export interface ErrorHandler {
  action: "continue" | "stop" | "retry" | "goto";
  retryCount?: number;
  retryDelayMs?: number;
  retryBackoff?: "linear" | "exponential";
  gotoStepId?: string;
}

// Base step interface
export interface StepBase {
  id: string;
  type: StepTypeValue;
  name: string;
  description?: string;
  position: Position;
  next?: string | string[];
  onError?: ErrorHandler;
}

// Trigger configurations
export interface WebhookConfig {
  path?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  validatePayload?: boolean;
}

export interface CronConfig {
  expression: string;
  timezone?: string;
}

export interface EventConfig {
  source: string;
  eventType: string;
  filters?: Record<string, unknown>;
}

export interface ManualConfig {
  inputSchema?: Record<string, unknown>;
}

export type TriggerConfig =
  | WebhookConfig
  | CronConfig
  | EventConfig
  | ManualConfig;

// Trigger step
export interface TriggerStep extends StepBase {
  type: "trigger";
  trigger: {
    type: TriggerTypeValue;
    config: TriggerConfig;
  };
}

// Action step
export interface ActionStep extends StepBase {
  type: "action";
  action: {
    integrationId?: string;
    pluginId?: string;
    operation: string;
    inputs: Record<string, unknown>;
    outputs?: Record<string, string>;
  };
}

// Condition step (if/else)
export interface ConditionStep extends StepBase {
  type: "condition";
  condition: {
    expression: string;
    trueBranch: string;
    falseBranch: string;
  };
}

// Switch step (multi-branch)
export interface SwitchCase {
  value: string | number | boolean;
  label: string;
  next: string;
}

export interface SwitchStep extends StepBase {
  type: "switch";
  switch: {
    expression: string;
    cases: SwitchCase[];
    default?: string;
  };
}

// Loop step
export interface LoopStep extends StepBase {
  type: "loop";
  loop: {
    type: "forEach" | "while" | "times";
    collection?: string;
    condition?: string;
    count?: number;
    itemVariable?: string;
    indexVariable?: string;
    body: string[];
    maxIterations?: number;
  };
}

// Gate step (human approval or signal wait)
export interface GateStep extends StepBase {
  type: "gate";
  gate: {
    type: "approval" | "signal";
    approvers?: string[];
    signalName?: string;
    timeout?: string;
    timeoutAction?: "approve" | "reject" | "continue";
  };
}

// Delay step
export interface DelayStep extends StepBase {
  type: "delay";
  delay: {
    duration: number;
    unit: "seconds" | "minutes" | "hours" | "days";
  };
}

// Parallel step
export interface ParallelStep extends StepBase {
  type: "parallel";
  parallel: {
    branches: string[][];
    waitFor: "all" | "any" | number;
  };
}

// Plugin step (Extism)
export interface PluginStep extends StepBase {
  type: "plugin";
  plugin: {
    pluginId: string;
    function: string;
    inputs: Record<string, unknown>;
    outputs?: Record<string, string>;
    timeout?: number;
    memoryLimit?: number;
  };
}

// Union of all step types
export type Step =
  | TriggerStep
  | ActionStep
  | ConditionStep
  | SwitchStep
  | LoopStep
  | GateStep
  | DelayStep
  | ParallelStep
  | PluginStep;

// Edge definition for ReactFlow
export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

// Variable definition
export interface VariableDefinition {
  type: "string" | "number" | "boolean" | "object" | "array";
  default?: unknown;
  description?: string;
}

// Retry policy
export interface RetryPolicy {
  maxAttempts: number;
  backoffCoefficient: number;
  initialInterval: string;
  maxInterval: string;
}

// Workflow settings
export interface WorkflowSettings {
  timeout?: string;
  retryPolicy?: RetryPolicy;
}

// Complete workflow definition
export interface WorkflowDefinition {
  version: "1.0";
  steps: Step[];
  edges: Edge[];
  variables?: Record<string, VariableDefinition>;
  settings?: WorkflowSettings;
}

// Execution context types
export interface ExecutionInput {
  trigger: Record<string, unknown>;
  variables: Record<string, unknown>;
}

export interface StepResult {
  stepId: string;
  status: "success" | "failure" | "skipped";
  output?: unknown;
  error?: string;
  startedAt: string;
  completedAt: string;
}

export interface ExecutionResult {
  workflowId: string;
  runId: string;
  status: "completed" | "failed" | "cancelled";
  input: ExecutionInput;
  output: Record<string, unknown>;
  stepResults: StepResult[];
  startedAt: string;
  completedAt: string;
  error?: string;
}
