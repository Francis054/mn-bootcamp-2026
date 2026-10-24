import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EnvError, loadEnv } from '../config/env.js';
import { createDataSource } from '../database/data-source.js';
import { Argon2Hasher } from '../modules/auth/password-hasher.js';
import { UserEntity } from '../modules/users/user.entity.js';
import { UserRepository } from '../modules/users/user.repository.js';
import { UserService } from '../modules/users/user.service.js';
import { UserFacingError } from '../shared/errors/user-facing-error.js';
import { resolveAdminInput } from './admin-input.js';

export interface AdminCreateIO {
  argv: string[];
  env?: NodeJS.ProcessEnv;
  loadDotenv?: boolean;
  prompt?: (label: string) => Promise<string>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

/**
 * Create the first administrator. The password is never written to stdout,
 * stderr, or the log. The mailbox is not printed either.
 */
export async function runAdminCreate(options: AdminCreateIO): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const env = options.env ?? process.env;
  try {
    const input = await resolveAdminInput(options.argv, env, options.prompt ?? readHidden);
    const appEnv = loadEnv(env, { loadDotenv: options.loadDotenv ?? options.env === undefined });
    const dataSource = createDataSource(appEnv);
    await dataSource.initialize();
    try {
      const users = new UserService(
        new UserRepository(dataSource.getRepository(UserEntity)),
        new Argon2Hasher(),
      );
      const result = await users.createAdministrator({
        email: input.email,
        password: input.password,
        rotate: input.rotate,
        ...(input.displayName ? { displayName: input.displayName } : {}),
      });
      stdout(
        result === 'created'
          ? 'Administrator account is ready.'
          : 'Administrator password updated.',
      );
      return 0;
    } finally {
      if (dataSource.isInitialized) await dataSource.destroy();
    }
  } catch (error) {
    stderr(safeMessage(error));
    return 1;
  }
}

function safeMessage(error: unknown): string {
  if (error instanceof UserFacingError || error instanceof EnvError) return error.message;
  if (error instanceof Error && error.message === 'The auth tables are missing.')
    return error.message;
  return 'The administrator account was not created. Check DATABASE_URL and run the migrations.';
}

function readHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.reject(
      new UserFacingError(
        'Set ADMIN_BOOTSTRAP_PASSWORD. This terminal cannot hide a typed password.',
      ),
    );
  }
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      if (error) reject(error);
    };
    const onData = (chunk: string) => {
      if (chunk === '\n' || chunk === '\r' || chunk === '\u0004') {
        finish();
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (chunk === '\u0003') {
        finish(new UserFacingError('Cancelled.'));
        return;
      }
      if (chunk === '\u007f' || chunk === '\b') {
        value = value.slice(0, -1);
        return;
      }
      if (chunk.startsWith('\u001b')) return;
      value += chunk;
    };
    stdin.on('data', onData);
  });
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  runAdminCreate({ argv: process.argv.slice(2) })
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.stderr.write('The administrator account was not created.\n');
      process.exit(1);
    });
}
