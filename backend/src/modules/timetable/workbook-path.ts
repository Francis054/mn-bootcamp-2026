import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The workbook shipped with the repo. TIMETABLE_XLSX overrides it. */
export function timetableWorkbookPath(): string {
  const override = process.env.TIMETABLE_XLSX;
  if (override) return override;
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../../../data/seed/bootcamp-timetable-and-outline.xlsx');
}
