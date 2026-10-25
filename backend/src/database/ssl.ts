/**
 * pg parses `connectionString` and copies that object on top of the ssl
 * value TypeORM passes. `sslmode=require` becomes `ssl: {}`, which drops
 * `ca` and `rejectUnauthorized`. `uselibpqcompat=true&sslmode=require`
 * sets `rejectUnauthorized: false`. Those query keys are removed here so
 * the TLS options below are the ones the driver uses. `loadEnv` still
 * reads `sslmode` on the original URL.
 */
const SSL_QUERY_KEYS = new Set([
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'sslnegotiation',
  'uselibpqcompat',
]);

/** TLS options passed to TypeORM. `false` means the connection is not encrypted. */
export type DriverSsl = false | { rejectUnauthorized: true; ca?: string };

/**
 * URL handed to the driver. The password and every non-SSL query parameter
 * stay as they were written. SSL parameters are removed so they cannot
 * replace `sslConfigForDriver`.
 */
export function connectionUrlForDriver(databaseUrl: string): string {
  const hashAt = databaseUrl.indexOf('#');
  const beforeHash = hashAt === -1 ? databaseUrl : databaseUrl.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : databaseUrl.slice(hashAt);
  const queryAt = beforeHash.indexOf('?');
  if (queryAt === -1) return databaseUrl;

  const base = beforeHash.slice(0, queryAt);
  const kept = beforeHash
    .slice(queryAt + 1)
    .split('&')
    .filter((part) => part !== '' && !SSL_QUERY_KEYS.has(queryKey(part)));
  if (kept.length === 0) return `${base}${hash}`;
  return `${base}?${kept.join('&')}${hash}`;
}

/**
 * Certificate verification stays on whenever SSL is on. The CA is added
 * only when `DATABASE_SSL_CA` was set. Node then trusts that CA instead of
 * its built-in list.
 */
export function sslConfigForDriver(
  databaseSsl: boolean,
  databaseSslCa: string | undefined,
): DriverSsl {
  if (!databaseSsl) return false;
  if (databaseSslCa === undefined) return { rejectUnauthorized: true };
  return { rejectUnauthorized: true, ca: databaseSslCa };
}

function queryKey(part: string): string {
  const rawName = part.split('=')[0] ?? '';
  const plusAsSpace = rawName.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(plusAsSpace).toLowerCase();
  } catch {
    return plusAsSpace.toLowerCase();
  }
}
