/**
 * Vortex Workflow JSON DSL Zod Schemas
 *
 * Validation schemas for workflow definitions.
 */

import { z } from "zod";

// Step types enum
export const stepTypeSchema = z.enum([
  "trigger",
  "action",
  "condition",
  "switch",
  "loop",
  "gate",
  "delay",
  "parallel",
  "plugin",
]);

// Trigger types enum
export const triggerTypeSchema = z.enum(["webhook", "cron", "event", "manual"]);

// Position schema
export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Error handler schema
export const errorHandlerSchema = z.object({
  action: z.enum(["continue", "stop", "retry", "goto"]),
  retryCount: z.number().int().positive().optional(),
  retryDelayMs: z.number().int().positive().optional(),
  retryBackoff: z.enum(["linear", "exponential"]).optional(),
  gotoStepId: z.string().optional(),
});

// Base step schema (shared fields)
const stepBaseSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  description: z.string().optional(),
  position: positionSchema,
  next: z.union([z.string(), z.array(z.string())]).optional(),
  onError: errorHandlerSchema.optional(),
});

// Trigger config schemas
export const webhookConfigSchema = z.object({
  path: z.string().optional(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  validatePayload: z.boolean().optional(),
});

export const cronConfigSchema = z.object({
  expression: z.string().nonempty(),
  timezone: z.string().optional(),
});

export const eventConfigSchema = z.object({
  source: z.string().nonempty(),
  eventType: z.string().nonempty(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const manualConfigSchema = z.object({
  inputSchema: z.record(z.string(), z.unknown()).optional(),
});

// Trigger step schema
export const triggerStepSchema = stepBaseSchema.extend({
  type: z.literal("trigger"),
  trigger: z.object({
    type: triggerTypeSchema,
    config: z.union([
      webhookConfigSchema,
      cronConfigSchema,
      eventConfigSchema,
      manualConfigSchema,
    ]),
  }),
});

// Action step schema
export const actionStepSchema = stepBaseSchema.extend({
  type: z.literal("action"),
  action: z.object({
    integrationId: z.string().uuid().optional(),
    pluginId: z.string().uuid().optional(),
    operation: z.string().nonempty(),
    inputs: z.record(z.string(), z.unknown()),
    outputs: z.record(z.string(), z.string()).optional(),
  }),
});

// Condition step schema
export const conditionStepSchema = stepBaseSchema.extend({
  type: z.literal("condition"),
  condition: z.object({
    expression: z.string().nonempty(),
    trueBranch: z.string().nonempty(),
    falseBranch: z.string().nonempty(),
  }),
});

// Switch case schema
export const switchCaseSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string().nonempty(),
  next: z.string().nonempty(),
});

// Switch step schema
export const switchStepSchema = stepBaseSchema.extend({
  type: z.literal("switch"),
  switch: z.object({
    expression: z.string().nonempty(),
    cases: z.array(switchCaseSchema).nonempty(),
    default: z.string().optional(),
  }),
});

// Loop step schema
export const loopStepSchema = stepBaseSchema.extend({
  type: z.literal("loop"),
  loop: z.object({
    type: z.enum(["forEach", "while", "times"]),
    collection: z.string().optional(),
    condition: z.string().optional(),
    count: z.number().int().positive().optional(),
    itemVariable: z.string().optional(),
    indexVariable: z.string().optional(),
    body: z.array(z.string()).nonempty(),
    maxIterations: z.number().int().positive().optional(),
  }),
});

// Gate step schema
export const gateStepSchema = stepBaseSchema.extend({
  type: z.literal("gate"),
  gate: z.object({
    type: z.enum(["approval", "signal"]),
    approvers: z.array(z.string()).optional(),
    signalName: z.string().optional(),
    timeout: z.string().optional(),
    timeoutAction: z.enum(["approve", "reject", "continue"]).optional(),
  }),
});

// Delay step schema
export const delayStepSchema = stepBaseSchema.extend({
  type: z.literal("delay"),
  delay: z.object({
    duration: z.number().positive(),
    unit: z.enum(["seconds", "minutes", "hours", "days"]),
  }),
});

// Parallel step schema
export const parallelStepSchema = stepBaseSchema.extend({
  type: z.literal("parallel"),
  parallel: z.object({
    branches: z
      .array(z.array(z.string()))
      .min(2, "At least 2 branches required"),
    waitFor: z.union([
      z.literal("all"),
      z.literal("any"),
      z.number().int().positive(),
    ]),
  }),
});

// Plugin step schema
export const pluginStepSchema = stepBaseSchema.extend({
  type: z.literal("plugin"),
  plugin: z.object({
    pluginId: z.string().uuid(),
    function: z.string().nonempty(),
    inputs: z.record(z.string(), z.unknown()),
    outputs: z.record(z.string(), z.string()).optional(),
    timeout: z.number().int().positive().optional(),
    memoryLimit: z.number().int().positive().optional(),
  }),
});

// Union of all step schemas
export const stepSchema = z.discriminatedUnion("type", [
  triggerStepSchema,
  actionStepSchema,
  conditionStepSchema,
  switchStepSchema,
  loopStepSchema,
  gateStepSchema,
  delayStepSchema,
  parallelStepSchema,
  pluginStepSchema,
]);

// Edge schema
export const edgeSchema = z.object({
  id: z.string().nonempty(),
  source: z.string().nonempty(),
  target: z.string().nonempty(),
  sourceHandle: z.string().optional(),
  label: z.string().optional(),
});

// Variable definition schema
export const variableDefinitionSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  default: z.unknown().optional(),
  description: z.string().optional(),
});

// Retry policy schema
export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().positive(),
  backoffCoefficient: z.number().positive(),
  initialInterval: z.string().nonempty(),
  maxInterval: z.string().nonempty(),
});

// Workflow settings schema
export const workflowSettingsSchema = z.object({
  timeout: z.string().optional(),
  retryPolicy: retryPolicySchema.optional(),
});

// Complete workflow definition schema
export const workflowDefinitionSchema = z.object({
  version: z.literal("1.0"),
  steps: z.array(stepSchema).nonempty(),
  edges: z.array(edgeSchema),
  variables: z.record(z.string(), variableDefinitionSchema).optional(),
  settings: workflowSettingsSchema.optional(),
});

import type { WorkflowDefinition } from "./types";

/**
 * Validate a workflow definition.
 */
export function validateWorkflowDefinition(
  definition: unknown,
): WorkflowDefinition {
  return workflowDefinitionSchema.parse(definition) as WorkflowDefinition;
}

/**
 * Safely validate a workflow definition, returning errors if invalid.
 */
export function safeValidateWorkflowDefinition(definition: unknown) {
  return workflowDefinitionSchema.safeParse(definition);
}
