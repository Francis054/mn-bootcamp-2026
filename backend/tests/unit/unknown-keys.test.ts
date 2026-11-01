import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSignup } from '../../src/modules/trainee-auth/signup.rules.js';
import { readProfilePatch } from '../../src/modules/trainees/profile-links.js';
import { readItemWrite } from '../../src/modules/portfolio/portfolio-rules.js';
import { readSkillWrite, emptySkill } from '../../src/modules/progress/progress-rules.js';

/**
 * These two prefixes were already applied in pairs. New files must not reuse a prefix.
 * Do not rename the applied files.
 */
const KNOWN_SHARED_PREFIXES = new Set(['1794096000000', '1794182400000']);

describe('unknown JSON keys', () => {
  it('rejects a privileged field on signup, profile, portfolio, and skills', () => {
    const signup = parseSignup({
      email: 'trainee01@example.test',
      password: 'Correct-horse-1',
      confirm: 'Correct-horse-1',
      displayName: 'Fictional',
      acceptTerms: true,
      isAdmin: true,
    });
    expect(signup.ok).toBe(false);
    if (!signup.ok) expect(signup.problems.isAdmin).toBe('This field is not recognised.');

    const profile = readProfilePatch({ displayName: 'Fictional', role: 'administrator' });
    expect(profile.errors.role).toBe('This field is not recognised.');

    const item = readItemWrite({ kind: 'lab', title: 'Lab', summary: '', isAdmin: true }, 'create');
    expect(item.errors.isAdmin).toBe('This field is not recognised.');

    const skill = readSkillWrite({ name: 'Wireshark', level: 2, isAdmin: true }, 'create', emptySkill());
    expect(skill.errors.isAdmin).toBe('This field is not recognised.');
  });
});

describe('migration timestamps', () => {
  it('allows only the two prefixes that were already shared', () => {
    const directory = path.resolve(process.cwd(), 'src/database/migrations');
    const prefixes = readdirSync(directory)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => name.slice(0, 13));
    const counts = new Map<string, number>();
    for (const prefix of prefixes) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    const unexpected: string[] = [];
    for (const [prefix, count] of counts) {
      if (count === 1) continue;
      if (KNOWN_SHARED_PREFIXES.has(prefix) && count === 2) continue;
      unexpected.push(`${prefix} x${count}`);
    }
    for (const known of KNOWN_SHARED_PREFIXES) {
      if (counts.get(known) !== 2) unexpected.push(`${known} expected twice`);
    }
    expect(unexpected).toEqual([]);
  });
});
