/**
 * Drizzle ORM relations definitions.
 * All relations are defined here to avoid circular import issues.
 */

import { relations } from "drizzle-orm";

import { approvalRequestTable } from "./approvalRequest.table";
import { deadLetterEventTable } from "./deadLetterEvent.table";
import { eventRoutingRuleTable } from "./eventRoutingRule.table";
import { fnTable } from "./fn.table";
import { integrationTable } from "./integration.table";
import { integrationDefinitionTable } from "./integrationDefinition.table";
import { mcpServerTable } from "./mcpServer.table";
import { oauthTokenTable } from "./oauthToken.table";
import { pluginTable } from "./plugin.table";
import { pluginUsageTable } from "./pluginUsage.table";
import { rivetGraphTable } from "./rivetGraph.table";
import { userTable } from "./user.table";
import { userOrganizationTable } from "./userOrganization.table";
import { workflowTable } from "./workflow.table";
import { workflowRunTable } from "./workflowRun.table";
import { workflowStepLogTable } from "./workflowStepLog.table";
import { workflowVersionTable } from "./workflowVersion.table";

// User relations
export const userRelations = relations(userTable, ({ many }) => ({
  organizations: many(userOrganizationTable),
}));

// Workflow relations
export const workflowRelations = relations(workflowTable, ({ one, many }) => ({
  createdByUser: one(userTable, {
    fields: [workflowTable.createdBy],
    references: [userTable.id],
  }),
  runs: many(workflowRunTable),
  eventRoutingRules: many(eventRoutingRuleTable),
  versions: many(workflowVersionTable),
  approvalRequests: many(approvalRequestTable),
}));

// WorkflowRun relations
export const workflowRunRelations = relations(
  workflowRunTable,
  ({ one, many }) => ({
    workflow: one(workflowTable, {
      fields: [workflowRunTable.workflowId],
      references: [workflowTable.id],
    }),
    stepLogs: many(workflowStepLogTable),
  }),
);

// WorkflowStepLog relations
export const workflowStepLogRelations = relations(
  workflowStepLogTable,
  ({ one }) => ({
    workflowRun: one(workflowRunTable, {
      fields: [workflowStepLogTable.workflowRunId],
      references: [workflowRunTable.id],
    }),
  }),
);

// Plugin relations
export const pluginRelations = relations(pluginTable, ({ one, many }) => ({
  author: one(userTable, {
    fields: [pluginTable.authorId],
    references: [userTable.id],
  }),
  usageRecords: many(pluginUsageTable),
}));

// Plugin usage relations
export const pluginUsageRelations = relations(pluginUsageTable, ({ one }) => ({
  plugin: one(pluginTable, {
    fields: [pluginUsageTable.pluginId],
    references: [pluginTable.id],
  }),
}));

// Integration Definition relations
export const integrationDefinitionRelations = relations(
  integrationDefinitionTable,
  ({ many }) => ({
    integrations: many(integrationTable),
  }),
);

// Integration relations
export const integrationRelations = relations(
  integrationTable,
  ({ one, many }) => ({
    integrationDefinition: one(integrationDefinitionTable, {
      fields: [integrationTable.definitionId],
      references: [integrationDefinitionTable.id],
    }),
    mcpServer: one(mcpServerTable, {
      fields: [integrationTable.mcpServerId],
      references: [mcpServerTable.id],
    }),
    oauthTokens: many(oauthTokenTable),
  }),
);

// OAuth Token relations
export const oauthTokenRelations = relations(oauthTokenTable, ({ one }) => ({
  integration: one(integrationTable, {
    fields: [oauthTokenTable.integrationId],
    references: [integrationTable.id],
  }),
}));

// MCP Server relations (no FK relations after removing organization)
export const mcpServerRelations = relations(mcpServerTable, () => ({}));

// Event Routing Rule relations
export const eventRoutingRuleRelations = relations(
  eventRoutingRuleTable,
  ({ one, many }) => ({
    workflow: one(workflowTable, {
      fields: [eventRoutingRuleTable.workflowId],
      references: [workflowTable.id],
    }),
    deadLetterEvents: many(deadLetterEventTable),
  }),
);

// Dead Letter Event relations
export const deadLetterEventRelations = relations(
  deadLetterEventTable,
  ({ one }) => ({
    routingRule: one(eventRoutingRuleTable, {
      fields: [deadLetterEventTable.routingRuleId],
      references: [eventRoutingRuleTable.id],
    }),
  }),
);

// Approval Request relations
export const approvalRequestRelations = relations(
  approvalRequestTable,
  ({ one }) => ({
    workflow: one(workflowTable, {
      fields: [approvalRequestTable.workflowId],
      references: [workflowTable.id],
    }),
  }),
);

// Workflow Version relations
export const workflowVersionRelations = relations(
  workflowVersionTable,
  ({ one }) => ({
    workflow: one(workflowTable, {
      fields: [workflowVersionTable.workflowId],
      references: [workflowTable.id],
    }),
    createdByUser: one(userTable, {
      fields: [workflowVersionTable.createdBy],
      references: [userTable.id],
    }),
  }),
);

// FaaS function relations (no FK references)
export const fnRelations = relations(fnTable, () => ({}));

// Rivet Graph relations (no FK references)
export const rivetGraphRelations = relations(rivetGraphTable, () => ({}));
