export function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function readError(body: unknown): { code: string; message: string } {
  const error = readRecord(readRecord(body).error);
  if (typeof error.code !== 'string' || typeof error.message !== 'string') {
    throw new Error('Expected an error code and message.');
  }
  return { code: error.code, message: error.message };
}
