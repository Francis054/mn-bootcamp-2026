import { describe, expect, it } from 'vitest';
import { filterDirectory } from '@/domain/directory';
import type { PublicTrainee } from '@/domain/types';

const row = {
  id: '1',
  displayName: 'Sample Trainee 01',
  initials: 'T1',
  hue: 140,
  track: 'Blue team',
  focus: 'network',
  skills: ['Wireshark'],
  bio: 'A public bio.',
  quote: '',
  photoUrl: null,
  listing: 'public',
  publicationStatus: 'published',
  statusLabel: 'In training',
  contactAvailable: true,
} as PublicTrainee;

describe('trainee directory filters', () => {
  it('keeps a skill match and drops a search that is not on the public profile', () => {
    expect(filterDirectory([row], { q: '', track: 'Blue team', focus: '', skill: 'Wireshark' })).toHaveLength(1);
    expect(filterDirectory([row], { q: 'trainee01@example.test', track: '', focus: '', skill: '' })).toHaveLength(0);
    expect(filterDirectory([row], { q: 'wireshark', track: 'Red team', focus: '', skill: '' })).toHaveLength(0);
  });
});
