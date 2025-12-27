/**
 * Drizzle ORM relations definitions.
 * All relations are defined here to avoid circular import issues.
 */

import { relations } from "drizzle-orm";

import { integrationTable } from "./integration.table";
import { integrationDefinitionTable } from "./integrationDefinition.table";
import { invitationTable } from "./invitation.table";
import { mcpServerTable } from "./mcpServer.table";
import { pluginTable } from "./plugin.table";
import { userTable } from "./user.table";
import { workflowTable } from "./workflow.table";
import { workflowRunTable } from "./workflowRun.table";
import { workflowStepLogTable } from "./workflowStepLog.table";
import { workspaceTable } from "./workspace.table";
import { workspaceUserTable } from "./workspaceUser.table";

// User relations
export const userRelations = relations(userTable, ({ many }) => ({
  workspaceUsers: many(workspaceUserTable),
}));

// Workspace relations
export const workspaceRelations = relations(workspaceTable, ({ many }) => ({
  workspaceUsers: many(workspaceUserTable),
  workflows: many(workflowTable),
  integrations: many(integrationTable),
  mcpServers: many(mcpServerTable),
  plugins: many(pluginTable),
  invitations: many(invitationTable),
}));

// WorkspaceUser relations
export const workspaceUserRelations = relations(
  workspaceUserTable,
  ({ one }) => ({
    workspace: one(workspaceTable, {
      fields: [workspaceUserTable.workspaceId],
      references: [workspaceTable.id],
    }),
    user: one(userTable, {
      fields: [workspaceUserTable.userId],
      references: [userTable.id],
    }),
  }),
);

// Invitation relations
export const invitationRelations = relations(invitationTable, ({ one }) => ({
  workspace: one(workspaceTable, {
    fields: [invitationTable.workspaceId],
    references: [workspaceTable.id],
  }),
  invitedByUser: one(userTable, {
    fields: [invitationTable.invitedBy],
    references: [userTable.id],
  }),
}));

// Workflow relations
export const workflowRelations = relations(workflowTable, ({ one, many }) => ({
  workspace: one(workspaceTable, {
    fields: [workflowTable.workspaceId],
    references: [workspaceTable.id],
  }),
  createdByUser: one(userTable, {
    fields: [workflowTable.createdBy],
    references: [userTable.id],
  }),
  runs: many(workflowRunTable),
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
export const pluginRelations = relations(pluginTable, ({ one }) => ({
  workspace: one(workspaceTable, {
    fields: [pluginTable.workspaceId],
    references: [workspaceTable.id],
  }),
  author: one(userTable, {
    fields: [pluginTable.authorId],
    references: [userTable.id],
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
export const integrationRelations = relations(integrationTable, ({ one }) => ({
  workspace: one(workspaceTable, {
    fields: [integrationTable.workspaceId],
    references: [workspaceTable.id],
  }),
  integrationDefinition: one(integrationDefinitionTable, {
    fields: [integrationTable.definitionId],
    references: [integrationDefinitionTable.id],
  }),
  mcpServer: one(mcpServerTable, {
    fields: [integrationTable.mcpServerId],
    references: [mcpServerTable.id],
  }),
}));

// MCP Server relations
export const mcpServerRelations = relations(mcpServerTable, ({ one }) => ({
  workspace: one(workspaceTable, {
    fields: [mcpServerTable.workspaceId],
    references: [workspaceTable.id],
  }),
}));
