import { UserFacingError } from '../shared/errors/user-facing-error.js';

export interface AdminInput {
  email: string;
  password: string;
  rotate: boolean;
  displayName?: string;
}

/**
 * Read the mailbox from an argument or `ADMIN_EMAIL`. Read the password from
 * `ADMIN_BOOTSTRAP_PASSWORD` or from the prompt function. Never from the
 * command line, so it does not land in shell history.
 */
export async function resolveAdminInput(
  argv: string[],
  env: NodeJS.ProcessEnv,
  prompt: (label: string) => Promise<string>,
): Promise<AdminInput> {
  if (argv.some((arg) => arg === '--password' || arg.startsWith('--password='))) {
    throw new UserFacingError(
      'Do not put the password on the command line. Use ADMIN_BOOTSTRAP_PASSWORD or the hidden prompt.',
    );
  }

  const emailFlag = readOption(argv, '--email');
  const positional = positionalArguments(argv);
  if (positional.length > 1) {
    throw new UserFacingError('Pass one mailbox, either as an argument or with --email.');
  }
  const positionalEmail = positional[0];
  const envEmail = env.ADMIN_EMAIL?.trim();
  const email = emailFlag || positionalEmail || envEmail || '';
  if (emailFlag && positionalEmail && emailFlag !== positionalEmail) {
    throw new UserFacingError('Pass one mailbox, either as an argument or with --email.');
  }
  if (email === '') {
    throw new UserFacingError('Set the mailbox with an argument, --email, or ADMIN_EMAIL.');
  }

  const name = readOption(argv, '--name');
  if (name !== undefined && name.trim() === '') {
    throw new UserFacingError('The name cannot be empty.');
  }

  const fromEnv = env.ADMIN_BOOTSTRAP_PASSWORD;
  delete env.ADMIN_BOOTSTRAP_PASSWORD;
  let password = fromEnv;
  if (password === undefined || password === '') {
    const first = await prompt('Password: ');
    const second = await prompt('Password again: ');
    if (first !== second) {
      throw new UserFacingError('The two passwords do not match.');
    }
    password = first;
  }

  const input: AdminInput = {
    email,
    password,
    rotate: argv.includes('--rotate'),
  };
  if (name !== undefined) input.displayName = name.trim();
  return input;
}

/** Values that follow `--email` or `--name` are not mailbox arguments. */
function positionalArguments(argv: string[]): string[] {
  const flagValues = new Set<number>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--email' || arg === '--name') flagValues.add(index + 1);
  }
  return argv.filter((arg, index) => !arg.startsWith('--') && !flagValues.has(index));
}

function readOption(argv: string[], flag: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UserFacingError(`Provide a value after ${flag}.`);
      }
      return value;
    }
    if (arg?.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return undefined;
}
