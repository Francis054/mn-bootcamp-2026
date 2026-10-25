/**
 * Join tables that record which classes, trainees, projects, and photos an
 * admin picked. Table and column names are fixed here so a request cannot
 * choose them.
 */

const LINKS = {
  trainee_lessons: ['trainee_id', 'lesson_id'],
  project_lessons: ['project_id', 'lesson_id'],
  event_lessons: ['event_id', 'lesson_id'],
  event_projects: ['event_id', 'project_id'],
  event_media: ['event_id', 'media_id'],
} as const;

export type LinkTable = keyof typeof LINKS;

type Query = (sql: string, params?: unknown[]) => Promise<unknown>;

export async function groupedIds(
  query: Query,
  table: LinkTable,
  parentIds: readonly string[],
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>();
  if (parentIds.length === 0) return grouped;
  const [parent, child] = LINKS[table];
  const rows: unknown = await query(
    `SELECT ${parent} AS parent_id, ${child} AS child_id FROM ${table} WHERE ${parent} = ANY($1::varchar[]) ORDER BY ${child}`,
    [parentIds],
  );
  if (!Array.isArray(rows)) return grouped;
  for (const entry of rows) {
    const item: unknown = entry;
    if (typeof item !== 'object' || item === null) continue;
    if (!('parent_id' in item) || !('child_id' in item)) continue;
    const parentId: unknown = item.parent_id;
    const childId: unknown = item.child_id;
    if (typeof parentId !== 'string' || typeof childId !== 'string') continue;
    const list = grouped.get(parentId) ?? [];
    list.push(childId);
    grouped.set(parentId, list);
  }
  return grouped;
}

export async function replaceIds(
  query: Query,
  table: LinkTable,
  parentId: string,
  childIds: readonly string[],
): Promise<void> {
  const [parent, child] = LINKS[table];
  await query(`DELETE FROM ${table} WHERE ${parent} = $1`, [parentId]);
  for (const childId of childIds) {
    await query(`INSERT INTO ${table} (${parent}, ${child}) VALUES ($1, $2)`, [parentId, childId]);
  }
}
