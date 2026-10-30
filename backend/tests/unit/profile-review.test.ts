import { describe, expect, it } from 'vitest';
import { readImage } from '../../src/modules/gallery/image-bytes.js';
import { stripImageMetadata } from '../../src/modules/gallery/strip-metadata.js';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_WORDING,
  applyPublicProfileConsent,
  readConsentChoices,
} from '../../src/modules/trainees/consent-policy.js';
import { githubProblem, linkedinProblem, readProfilePatch } from '../../src/modules/trainees/profile-links.js';
import {
  approveReview,
  rejectReview,
  statusAfterEdit,
  submitForReview,
  visiblePhotoUrl,
} from '../../src/modules/trainees/profile-review.js';

describe('profile review', () => {
  it('keeps the last approved profile in place until a new edit is approved', () => {
    expect(statusAfterEdit('approved')).toBe('draft');
    expect(statusAfterEdit('rejected')).toBe('draft');
    expect(statusAfterEdit('pending')).toBe('pending');
    expect(statusAfterEdit('draft')).toBe('draft');
    expect(submitForReview('draft', false).ok).toBe(false);
    expect(submitForReview('approved', true).ok).toBe(false);
    expect(submitForReview('draft', true)).toEqual({ ok: true, status: 'pending' });
    expect(submitForReview('rejected', true)).toEqual({ ok: true, status: 'pending' });
    expect(submitForReview('pending', true).ok).toBe(false);
    expect(approveReview('draft').ok).toBe(false);
    expect(approveReview('pending')).toEqual({ ok: true, status: 'approved' });
    expect(rejectReview('pending', '  ').ok).toBe(false);
    expect(rejectReview('approved', 'No').ok).toBe(false);
    expect(rejectReview('pending', ' The bio names a client. ')).toEqual({
      ok: true,
      status: 'rejected',
      reason: 'The bio names a client.',
    });
  });

  it('shows a photo only when photo consent is on', () => {
    expect(visiblePhotoUrl('/photo.png', false)).toBeNull();
    expect(visiblePhotoUrl(null, true)).toBeNull();
    expect(visiblePhotoUrl('/photo.png', true)).toBe('/photo.png');
  });
});

describe('profile links and consent', () => {
  it('accepts LinkedIn and GitHub links and ignores another trainee id', () => {
    expect(linkedinProblem('https://www.linkedin.com/in/trainee')).toBeUndefined();
    expect(linkedinProblem('https://linkedin.com/in/trainee')).toBeUndefined();
    expect(linkedinProblem('https://evil.example/linkedin.com')).toBeTruthy();
    expect(linkedinProblem('http://www.linkedin.com/in/trainee')).toBeTruthy();
    expect(githubProblem('https://github.com/trainee')).toBeUndefined();
    expect(githubProblem('https://gist.github.com/trainee')).toBeTruthy();
    const parsed = readProfilePatch({
      traineeId: 'someone-else',
      displayName: 'Ama Mensah',
      linkedin: 'https://www.linkedin.com/in/ama',
      githubUrl: '',
      portfolio: 'https://ama.example',
    });
    expect(parsed.errors).toEqual({});
    expect(parsed.value).not.toHaveProperty('traineeId');
    expect(parsed.value.githubUrl).toBeNull();
    expect(parsed.value.displayName).toBe('Ama Mensah');
  });

  it('stores a wording version and unpublishes when public profile consent is withdrawn', () => {
    expect(CONSENT_POLICY_VERSION).toBe('2026-10-28');
    expect(CONSENT_WORDING.public_profile).toContain('administrator approves');
    expect(CONSENT_WORDING.public_profile.toLowerCase()).not.toContain('12 month');
    expect(CONSENT_WORDING.public_profile.toLowerCase()).not.toContain('18');
    expect(applyPublicProfileConsent({
      granted: false,
      reviewStatus: 'approved',
      listing: 'public',
      publicationStatus: 'published',
    })).toEqual({ consentReceived: false, publicationStatus: 'draft', withdrawing: true });
    expect(applyPublicProfileConsent({
      granted: true,
      reviewStatus: 'pending',
      listing: 'hidden',
      publicationStatus: 'draft',
    }).publicationStatus).toBe('draft');
    expect(applyPublicProfileConsent({
      granted: true,
      reviewStatus: 'approved',
      listing: 'public',
      publicationStatus: 'draft',
    }).publicationStatus).toBe('published');
    expect(readConsentChoices({ publicPhoto: true, traineeId: 'other' }).value).toEqual({
      publicPhoto: true,
    });
    expect(readConsentChoices({ publicProfile: 'yes' }).errors.publicProfile).toBeTruthy();
  });
});

describe('image metadata', () => {
  it('removes JPEG EXIF and GPS text and still recognises the image', () => {
    const app1 = Buffer.concat([
      Buffer.from([0xff, 0xe1, 0x00, 0x12]),
      Buffer.from('EXIF\0GPSLatitude', 'ascii'),
    ]);
    const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sof, Buffer.from([0xff, 0xd9])]);
    expect(jpeg.toString('ascii')).toContain('GPSLatitude');
    const stripped = stripImageMetadata(jpeg);
    expect(stripped.toString('ascii')).not.toContain('GPSLatitude');
    expect(stripped.toString('ascii')).not.toContain('EXIF');
    expect(readImage(stripped)?.mime).toBe('image/jpeg');
  });

  it('refuses SVG by leaving it unreadable as a photo', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>x</text></svg>');
    expect(readImage(stripImageMetadata(svg))).toBeUndefined();
  });

  it('drops a PNG text chunk', () => {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const text = Buffer.from('Comment\0GPSLatitude', 'ascii');
    const textChunk = Buffer.alloc(12 + text.length);
    textChunk.writeUInt32BE(text.length, 0);
    textChunk.write('tEXt', 4, 'ascii');
    text.copy(textChunk, 8);
    const iend = Buffer.alloc(12);
    iend.writeUInt32BE(0, 0);
    iend.write('IEND', 4, 'ascii');
    const png = Buffer.concat([signature, textChunk, iend]);
    const stripped = stripImageMetadata(png);
    expect(stripped.toString('ascii')).not.toContain('GPSLatitude');
    expect(stripped.toString('ascii')).toContain('IEND');
  });
});
