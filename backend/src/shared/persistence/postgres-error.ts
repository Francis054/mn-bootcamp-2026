export function postgresCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  if (
    'driverError' in error &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    typeof error.driverError.code === 'string'
  ) {
    return error.driverError.code;
  }
  return undefined;
}
