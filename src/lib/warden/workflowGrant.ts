/**
 * Per-workflow permission grant helper.
 *
 * Reads the `workflow_permission` ACL (see
 * `lib/db/schema/workflowPermission.table.ts`) to answer whether a user holds a
 * grant that satisfies a minimum role on a specific workflow. This is the read
 * side of the ACL that the REST CRUD in `routes/permissions.ts` writes.
 *
 * Grants are keyed by the Vortex user id, so the caller's IDP (Gatekeeper) user
 * id is first resolved to a Vortex user.
 *
 * Role semantics: an `editor` grant satisfies both `viewer` and `editor`
 * requirements; a `viewer` grant satisfies `viewer` only.
 *
 * NB: only `editor` grants are currently enforced (they expand edit/delete
 * rights, see `Workflow.plugin.ts`). `viewer` grants are advisory for now,
 * pending a decision on whether to restrict workflow reads row-by-row; today
 * reads remain open to any org member, so honoring `viewer` here would not
 * change access. The `viewer` semantics are implemented so a future
 * read-restriction can adopt them without a signature change.
 */

import { and, eq } from "drizzle-orm";

import { dbPool } from "lib/db/db";
import { userTable, workflowPermissionTable } from "lib/db/schema";

/**
 * Roles that can be granted on an individual workflow. Module-local: callers
 * pass the literal `"viewer"`/`"editor"`, so nothing outside needs the name.
 */
type WorkflowGrantRole = "viewer" | "editor";

/**
 * Collaborators for {@link hasWorkflowGrant}. Each defaults to the real
 * DB-backed implementation; tests inject fakes so the role logic can be
 * exercised without a database.
 */
interface WorkflowGrantDeps {
  resolveVortexUserId?: (idpUserId: string) => Promise<string | null>;
  fetchGrant?: (
    workflowId: string,
    userId: string,
  ) => Promise<WorkflowGrantRole | null>;
}

/** Resolve a Gatekeeper (IDP) user id to the local Vortex user id. */
const defaultResolveVortexUserId = async (
  idpUserId: string,
): Promise<string | null> => {
  const user = await dbPool.query.userTable.findFirst({
    where: eq(userTable.identityProviderId, idpUserId),
    columns: { id: true },
  });
  return user?.id ?? null;
};

/** Fetch the grant (if any) for a user on a specific workflow. */
const defaultFetchGrant = async (
  workflowId: string,
  userId: string,
): Promise<WorkflowGrantRole | null> => {
  const grant = await dbPool.query.workflowPermissionTable.findFirst({
    where: and(
      eq(workflowPermissionTable.workflowId, workflowId),
      eq(workflowPermissionTable.userId, userId),
    ),
    columns: { permission: true },
  });

  if (grant?.permission === "editor" || grant?.permission === "viewer") {
    return grant.permission;
  }
  return null;
};

/**
 * Check whether a user holds a per-workflow grant that satisfies `minRole`.
 *
 * Returns false when no matching user or grant exists (fail-closed).
 */
const hasWorkflowGrant = async (
  idpUserId: string,
  workflowId: string,
  minRole: WorkflowGrantRole,
  deps: WorkflowGrantDeps = {},
): Promise<boolean> => {
  const {
    resolveVortexUserId = defaultResolveVortexUserId,
    fetchGrant = defaultFetchGrant,
  } = deps;

  const userId = await resolveVortexUserId(idpUserId);
  if (!userId) return false;

  const grant = await fetchGrant(workflowId, userId);
  if (!grant) return false;

  // An editor grant is a superset of viewer; a viewer grant only satisfies viewer
  if (minRole === "viewer") return grant === "viewer" || grant === "editor";
  return grant === "editor";
};

export default hasWorkflowGrant;
