export function postgresCode(error: unknown): string | undefined {
  return readField(error, 'code');
}

/** The constraint name on a foreign-key or unique failure, when Postgres sent one. */
export function postgresConstraint(error: unknown): string | undefined {
  return readField(error, 'constraint');
}

function readField(error: unknown, field: 'code' | 'constraint'): string | undefined {
  const direct = readNamed(error, field);
  if (direct) return direct;
  if (typeof error !== 'object' || error === null || !('driverError' in error)) return undefined;
  return readNamed(error.driverError, field);
}

function readNamed(value: unknown, field: 'code' | 'constraint'): string | undefined {
  if (typeof value !== 'object' || value === null || !(field in value)) return undefined;
  const record = value as Record<string, unknown>;
  const found = record[field];
  return typeof found === 'string' ? found : undefined;
}
