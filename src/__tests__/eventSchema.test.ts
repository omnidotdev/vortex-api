import { describe, expect, it } from "bun:test";

import { eventSchemaTable } from "lib/db/schema/eventSchema.table";

describe("eventSchemaTable", () => {
  it("exposes required columns", () => {
    const cols = Object.keys(eventSchemaTable);
    for (const col of ["id", "name", "source", "createdAt"]) {
      expect(cols).toContain(col);
    }
  });

  it("exposes versioning columns", () => {
    const cols = Object.keys(eventSchemaTable);
    for (const col of [
      "version",
      "compatibilityMode",
      "previousVersionId",
      "migrationTransform",
    ]) {
      expect(cols).toContain(col);
    }
  });
});
