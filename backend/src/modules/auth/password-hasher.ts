import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

/** OWASP Argon2id parameters. They live here so a deploy cannot weaken them with an env var. */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Argon2id hashes. A dummy hash is verified when the mailbox is unknown so
 * the response time stays close to a real check.
 */
export class Argon2Hasher {
  private dummyHash: string | undefined;

  async warm(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string | undefined, password: string): Promise<boolean> {
    const target = hash ?? this.dummyHash;
    if (!target) return false;
    try {
      const matches = await argon2.verify(target, password);
      return hash !== undefined && matches;
    } catch {
      return false;
    }
  }
}
