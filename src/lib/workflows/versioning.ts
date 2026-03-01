import { desc, eq } from "drizzle-orm";
import { EXPORTABLE } from "graphile-export";

import { dbPool as db } from "lib/db/db";
import { workflowVersionTable } from "lib/db/schema/workflowVersion.table";
import logger from "lib/logger";

type SaveWorkflowVersionParams = {
  workflowId: string;
  definition: unknown;
  createdBy?: string;
  changeNote?: string;
};

/**
 * Save a snapshot of a workflow definition as a new version.
 * Increments the version number based on the current max for the workflow.
 *
 * Wrapped in EXPORTABLE so PostGraphile can serialize the schema
 * when this function is referenced from authorization plugins.
 * @param params - Version snapshot parameters.
 * @returns Inserted version row.
 */
const saveWorkflowVersion = EXPORTABLE(
  (db, eq, desc, workflowVersionTable, logger) =>
    async ({
      workflowId,
      definition,
      createdBy,
      changeNote,
    }: SaveWorkflowVersionParams) => {
      const existing = await db.query.workflowVersionTable.findFirst({
        where: eq(workflowVersionTable.workflowId, workflowId),
        orderBy: desc(workflowVersionTable.version),
        columns: { version: true },
      });

      const nextVersion = (existing?.version ?? 0) + 1;

      const [inserted] = await db
        .insert(workflowVersionTable)
        .values({
          workflowId,
          version: nextVersion,
          definition,
          createdBy,
          changeNote,
        })
        .returning();

      logger.info("Saved workflow version", {
        workflowId,
        version: nextVersion,
      });

      return inserted;
    },
  [db, eq, desc, workflowVersionTable, logger],
);

export default saveWorkflowVersion;
