export interface Actor {
  userId: string | null;
  ip: string | null;
  requestId: string | null;
}

export function isoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}
