import type { Pool } from "pg";

/**
 * Per-table autovacuum settings for `event_log`.
 *
 * The retention sweep deletes about a day of events per day from a table of
 * millions of rows. With the global `autovacuum_vacuum_scale_factor` (0.2) the
 * table is only vacuumed once dead rows reach a fifth of it, so deleted rows
 * pile up for weeks as dead index entries that every prune and every
 * `recorded_at` range read has to step over. Vacuuming at 1% keeps them small.
 * Drizzle cannot declare storage parameters, so they are applied after
 * migrations by `src/scripts/db/migrate.ts`
 */
export const EVENT_LOG_AUTOVACUUM: Readonly<Record<string, string>> = {
  autovacuum_vacuum_scale_factor: "0.01",
  autovacuum_vacuum_threshold: "10000",
  autovacuum_analyze_scale_factor: "0.02",
};

/**
 * Settings from {@link EVENT_LOG_AUTOVACUUM} that `reloptions` (as stored in
 * `pg_class.reloptions`, `key=value` strings) does not already carry
 */
export const missingAutovacuumOptions = (
  reloptions: readonly string[] | null,
): string[] => {
  const current = new Map(
    (reloptions ?? []).map((option) => {
      const [key = "", value = ""] = option.split("=");
      return [key, value] as const;
    }),
  );

  return Object.entries(EVENT_LOG_AUTOVACUUM)
    .filter(([key, value]) => current.get(key) !== value)
    .map(([key]) => key);
};

/**
 * Apply the `event_log` autovacuum settings when they differ. A no-op on every
 * boot once set. `ALTER TABLE ... SET` takes only a SHARE UPDATE EXCLUSIVE
 * lock (it never blocks reads or writes); a failure is logged rather than
 * failing boot, since the table works without it
 */
export const tuneEventLogAutovacuum = async (
  pool: Pick<Pool, "query">,
  log: (message: string) => void = console.warn,
): Promise<void> => {
  try {
    const { rows } = await pool.query<{ reloptions: string[] | null }>(
      "SELECT reloptions FROM pg_class WHERE oid = to_regclass('public.event_log')",
    );
    const row = rows[0];
    if (!row) return;

    if (missingAutovacuumOptions(row.reloptions).length === 0) return;

    const settings = Object.entries(EVENT_LOG_AUTOVACUUM)
      .map(([key, value]) => `${key} = ${value}`)
      .join(", ");
    await pool.query(`ALTER TABLE public.event_log SET (${settings})`);
    console.info("[Migrate] Tuned event_log autovacuum");
  } catch (error) {
    log(
      `[Migrate] Could not tune event_log autovacuum: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
