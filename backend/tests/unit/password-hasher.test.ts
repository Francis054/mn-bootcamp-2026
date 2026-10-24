import { describe, expect, it } from 'vitest';
import { Argon2Hasher } from '../../src/modules/auth/password-hasher.js';

describe('Argon2Hasher', () => {
  it('stores an Argon2id hash and rejects a different password', async () => {
    const hasher = new Argon2Hasher();
    await hasher.warm();
    const hash = await hasher.hash('Correct-horse-1');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('Correct-horse-1');
    expect(await hasher.verify(hash, 'Correct-horse-1')).toBe(true);
    expect(await hasher.verify(hash, 'Correct-horse-2')).toBe(false);
    expect(await hasher.verify(undefined, 'Correct-horse-1')).toBe(false);
  });
});
