/**
 * Integration tests talk to a real Postgres. The database name must end with
 * `_test`. This refuses anything else before a connection is opened, so a
 * copied production URL cannot be emptied by a test run.
 */
export function assertTestDatabase(connectionUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL. The database name must end with _test.');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] ?? '');
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${name || '(none)'}". The name must end with _test.`,
    );
  }
  return name;
}

export async function openTestDatabase(): Promise<{ url: string; close: () => Promise<void> }> {
  const configured = process.env.TEST_DATABASE_URL;
  if (configured) {
    assertTestDatabase(configured);
    return {
      url: configured,
      close: () => Promise.resolve(),
    };
  }

  const { existsSync } = await import('node:fs');
  if (!existsSync('/var/run/docker.sock')) {
    throw new Error(
      'Set TEST_DATABASE_URL to a Postgres database whose name ends with _test, or run Docker so Testcontainers can start one. Tests will not create or wipe any other database.',
    );
  }

  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('mn_bootcamp_test')
    .withStartupTimeout(120_000)
    .start();
  const url = container.getConnectionUri();
  assertTestDatabase(url);
  return {
    url,
    close: async () => {
      await container.stop();
    },
  };
}
