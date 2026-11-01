export function readCheckArgs(
  argv: readonly string[],
): { ok: true; requireRoles: boolean } | { ok: false; message: string };

export function redactDatabaseUrl(text: string, databaseUrl: string | undefined): string;

export function reportPublicRls(input: {
  tables: { name: string; rlsEnabled: boolean; rlsForced: boolean }[];
  rolesPresent: string[];
  grants: { role: string; tables: string[]; sequences: string[] }[];
  migrationRecorded: boolean | null;
  requireRoles: boolean;
}): { ok: boolean; lines: string[]; problems: string[] };
