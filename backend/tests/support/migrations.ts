import type { DataSource } from 'typeorm';

export const MIGRATION_NAMES = [
  'Baseline1792800000000',
  'Auth1792868400000',
  'Curriculum1792886400000',
  'Trainees1792972800000',
  'Projects1793059200000',
  'Events1793145600000',
  'Gallery1793232000000',
  'Content1793318400000',
] as const;

const OURS = new Set<string>(MIGRATION_NAMES);

/** Undo only the migrations this repository owns, newest first. */
export async function revertOurMigrations(dataSource: DataSource): Promise<void> {
  for (;;) {
    const rows: unknown = await dataSource.query(
      'SELECT name FROM schema_migrations ORDER BY id DESC',
    );
    if (!Array.isArray(rows) || rows.length === 0) return;
    const row: unknown = rows[0];
    const name =
      typeof row === 'object' && row !== null && 'name' in row && typeof row.name === 'string'
        ? row.name
        : '';
    if (!OURS.has(name)) return;
    await dataSource.undoLastMigration();
  }
}
