import { dbPool } from "lib/db/db";

async function test() {
  const userId = "112d4b22-d085-425d-91b4-64005e9be537";
  const orgId = "d340a571-72ea-4f82-aba6-fc420c45d896";

  console.log("Testing query with:", { userId, orgId });

  const membership = await dbPool.query.userOrganizationTable.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.userId, userId),
        eq(table.organizationId, orgId),
      ),
  });

  console.log("Result:", membership);
  process.exit(0);
}

test().catch(console.error);
