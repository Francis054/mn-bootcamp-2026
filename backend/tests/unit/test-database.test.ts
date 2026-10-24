import { describe, expect, it } from 'vitest';
import { assertTestDatabase } from '../support/test-database.js';

describe('assertTestDatabase', () => {
  it('accepts a database whose name ends with _test and hides the rest of the URL', () => {
    expect(assertTestDatabase('postgres://user:secret@localhost:5432/mn_bootcamp_test')).toBe(
      'mn_bootcamp_test',
    );
  });

  it('refuses a name that does not end with _test and does not repeat the URL', () => {
    expect.assertions(2);
    try {
      assertTestDatabase('postgres://user:secret@localhost:5432/mn_bootcamp');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).toContain('mn_bootcamp');
      expect(message).not.toContain('secret');
    }
  });
});
