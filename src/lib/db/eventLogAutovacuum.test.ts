import { describe, expect, test } from "bun:test";

import {
  EVENT_LOG_AUTOVACUUM,
  missingAutovacuumOptions,
  tuneEventLogAutovacuum,
} from "./eventLogAutovacuum";

const allSet = Object.entries(EVENT_LOG_AUTOVACUUM).map(
  ([key, value]) => `${key}=${value}`,
);

/** Fake pg pool recording the statements it was given */
const fakePool = (reloptions: string[] | null, { tableExists = true } = {}) => {
  const queries: string[] = [];

  return {
    queries,
    query: async (text: string) => {
      queries.push(text);
      return {
        rows: text.startsWith("SELECT") && tableExists ? [{ reloptions }] : [],
      };
    },
  };
};

describe("missingAutovacuumOptions", () => {
  test("lists every setting for a table with no reloptions", () => {
    expect(missingAutovacuumOptions(null)).toEqual(
      Object.keys(EVENT_LOG_AUTOVACUUM),
    );
  });

  test("is empty once every setting is applied", () => {
    expect(missingAutovacuumOptions(allSet)).toEqual([]);
  });

  test("flags a setting holding a different value", () => {
    const drifted = allSet.map((option) =>
      option.startsWith("autovacuum_vacuum_scale_factor=")
        ? "autovacuum_vacuum_scale_factor=0.2"
        : option,
    );

    expect(missingAutovacuumOptions(drifted)).toEqual([
      "autovacuum_vacuum_scale_factor",
    ]);
  });
});

describe("tuneEventLogAutovacuum", () => {
  test("applies the settings when missing", async () => {
    const pool = fakePool(null);

    await tuneEventLogAutovacuum(pool as never);

    expect(pool.queries[1]).toBe(
      "ALTER TABLE public.event_log SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_threshold = 10000, autovacuum_analyze_scale_factor = 0.02)",
    );
  });

  test("is a no-op once applied (no ALTER on every boot)", async () => {
    const pool = fakePool(allSet);

    await tuneEventLogAutovacuum(pool as never);

    expect(pool.queries).toHaveLength(1);
  });

  test("skips a database without the table", async () => {
    const pool = fakePool(null, { tableExists: false });

    await tuneEventLogAutovacuum(pool as never);

    expect(pool.queries).toHaveLength(1);
  });

  test("logs instead of failing boot when the ALTER fails", async () => {
    const logged: string[] = [];
    const pool = {
      query: async (text: string) => {
        if (text.startsWith("ALTER")) {
          throw new Error("canceling statement due to lock timeout");
        }
        return { rows: [{ reloptions: null }] };
      },
    };

    await tuneEventLogAutovacuum(pool as never, (m) => logged.push(m));

    expect(logged[0]).toContain("lock timeout");
  });
});
