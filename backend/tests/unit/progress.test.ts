import { describe, expect, it } from 'vitest';
import {
  approveOwned,
  readEventWrite,
  readSkillWrite,
  rejectOwned,
  skillSlug,
  submitOwned,
  emptyEvent,
  emptySkill,
} from '../../src/modules/progress/progress-rules.js';

describe('skill and event rules', () => {
  it('builds a stable slug and keeps the level in range', () => {
    expect(skillSlug('Packet Analysis')).toBe('packet-analysis');
    expect(skillSlug('  ')).toBe('skill');
    const created = readSkillWrite({ name: 'Wireshark', level: 3, evidenceItemId: null }, 'create', emptySkill());
    expect(created.errors).toEqual({});
    expect(created.value).toEqual({ name: 'Wireshark', level: 3, evidenceItemId: null });
    const bad = readSkillWrite({ name: '', level: 9 }, 'create', emptySkill());
    expect(bad.errors.name).toMatch(/skill/i);
    expect(bad.errors.level).toMatch(/learning/i);
  });

  it('refuses a private or non-https event link and a made-up date', () => {
    const badLink = readEventWrite({ title: 'Local CTF', link: 'http://example.com' }, 'create', emptyEvent());
    expect(badLink.errors.link).toMatch(/https/);
    const privateHost = readEventWrite({ title: 'Local CTF', link: 'https://127.0.0.1/score' }, 'create', emptyEvent());
    expect(privateHost.errors.link).toMatch(/public/);
    const badDate = readEventWrite({ title: 'Local CTF', eventDate: '2026-02-31' }, 'create', emptyEvent());
    expect(badDate.errors.eventDate).toMatch(/real date/);
    const ok = readEventWrite(
      { title: 'Local CTF', eventDate: '2026-11-02', organiser: 'Accra Sec', link: 'https://example.com/ctf' },
      'create',
      emptyEvent(),
    );
    expect(ok.errors).toEqual({});
    expect(ok.value.link).toBe('https://example.com/ctf');
  });

  it('requires public-profile consent before a skill or event can be submitted', () => {
    expect(submitOwned('draft', false, 'skill').ok).toBe(false);
    expect(submitOwned('draft', true, 'event')).toEqual({ ok: true, status: 'pending' });
    expect(submitOwned('approved', true, 'skill').ok).toBe(false);
    expect(approveOwned('draft', 'event').ok).toBe(false);
    expect(approveOwned('pending', 'skill').ok).toBe(true);
    expect(rejectOwned('pending', '  ', 'event').ok).toBe(false);
    expect(rejectOwned('pending', 'Needs a date', 'event')).toEqual({ ok: true, reason: 'Needs a date' });
  });
});
