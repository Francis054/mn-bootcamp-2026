import { Transform } from 'class-transformer';
import { IsOptional, ValidateBy } from 'class-validator';
import { trimIdList } from '../../shared/validation/id-list.js';
import {
  consentMessage,
  displayNameMessage,
  linkConsentMessage,
  emailMessage,
  focusMessage,
  hueMessage,
  initialsMessage,
  lessonIdsMessage,
  listingMessage,
  optionalHttpUrlMessage,
  photoStorageKeyMessage,
  photoUrlMessage,
  plainTextMessage,
  publicationMessage,
  skillsMessage,
  trackMessage,
} from './trainee.rules.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

function skillsTransform({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return value;
  return value.map((item: string) => item.trim()).filter((item) => item.length > 0);
}

/** A blank link is stored as null. A provided link keeps its trimmed text for validation. */
function blankLink({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Body for `POST /admin/trainees`. Messages match the trainee form. */
export class TraineeCreateDto {
  @rule('displayName', displayNameMessage, 'Enter a display name.')
  displayName!: string;

  @rule('email', emailMessage, 'Enter your email address.')
  email!: string;

  @rule('track', trackMessage, 'Choose Blue team, Red team, or GRC & Awareness.')
  track!: string;

  @rule('focus', focusMessage, 'Choose a module.')
  focus!: string;

  @IsOptional()
  @rule('initials', initialsMessage, 'Use initials of at most 8 characters.')
  initials?: string;

  @IsOptional()
  @rule('hue', hueMessage, 'Choose a colour from 0 to 359.')
  hue?: number;

  @IsOptional()
  @Transform(skillsTransform)
  @rule('skills', skillsMessage, 'Enter skills as a list.')
  skills?: string[];

  @IsOptional()
  @rule('bio', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  bio?: string;

  @IsOptional()
  @rule('quote', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  quote?: string;

  @IsOptional()
  @Transform(blankLink)
  @rule('linkedin', optionalHttpUrlMessage, 'Enter a full link starting with https://')
  linkedin?: string | null;

  @IsOptional()
  @Transform(blankLink)
  @rule('portfolio', optionalHttpUrlMessage, 'Enter a full link starting with https://')
  portfolio?: string | null;

  @IsOptional()
  @rule('headline', (value) => plainTextMessage(typeof value === 'string' ? value.trim() : value, 160), 'Use at most 160 characters.')
  headline?: string;

  @IsOptional()
  @rule('location', (value) => plainTextMessage(typeof value === 'string' ? value.trim() : value, 120), 'Use at most 120 characters.')
  location?: string;

  @IsOptional()
  @Transform(blankLink)
  @rule('githubUrl', optionalHttpUrlMessage, 'Enter a full link starting with https://')
  githubUrl?: string | null;

  @IsOptional()
  @Transform(blankLink)
  @rule('photoUrl', photoUrlMessage, 'Use a JPEG, PNG, or WebP image.')
  photoUrl?: string | null;

  @IsOptional()
  @Transform(blankLink)
  @rule('photoStorageKey', photoStorageKeyMessage, 'Use a JPEG, PNG, or WebP image.')
  photoStorageKey?: string | null;

  @IsOptional()
  @Transform(trimIdList)
  @rule('lessonIds', lessonIdsMessage, 'Choose a class.')
  lessonIds?: string[];

  @IsOptional()
  @rule('consentReceived', consentMessage, 'Choose whether consent was received.')
  consentReceived?: boolean;

  @IsOptional()
  @rule(
    'linksShareConsent',
    linkConsentMessage,
    'Choose whether the trainee agreed to share links.',
  )
  linksShareConsent?: boolean;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('statusLabel', (value) => plainTextMessage(value, 80), 'Use at most 80 characters.')
  statusLabel?: string;

  @IsOptional()
  @rule('internalNotes', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;
}

/** Body for `PATCH /admin/trainees/:id`. Omitted fields stay as they are. */
export class TraineePatchDto {
  @IsOptional()
  @rule('displayName', displayNameMessage, 'Enter a display name.')
  displayName?: string;

  @IsOptional()
  @rule('email', emailMessage, 'Enter your email address.')
  email?: string;

  @IsOptional()
  @rule('track', trackMessage, 'Choose Blue team, Red team, or GRC & Awareness.')
  track?: string;

  @IsOptional()
  @rule('focus', focusMessage, 'Choose a module.')
  focus?: string;

  @IsOptional()
  @rule('initials', initialsMessage, 'Use initials of at most 8 characters.')
  initials?: string;

  @IsOptional()
  @rule('hue', hueMessage, 'Choose a colour from 0 to 359.')
  hue?: number;

  @IsOptional()
  @Transform(skillsTransform)
  @rule('skills', skillsMessage, 'Enter skills as a list.')
  skills?: string[];

  @IsOptional()
  @rule('bio', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  bio?: string;

  @IsOptional()
  @rule('quote', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  quote?: string;

  @IsOptional()
  @Transform(blankLink)
  @rule('linkedin', optionalHttpUrlMessage, 'Enter a full link starting with https://')
  linkedin?: string | null;

  @IsOptional()
  @Transform(blankLink)
  @rule('portfolio', optionalHttpUrlMessage, 'Enter a full link starting with https://')
  portfolio?: string | null;

  @IsOptional()
  @rule('headline', (value) => plainTextMessage(typeof value === 'string' ? value.trim() : value, 160), 'Use at most 160 characters.')
  headline?: string;

  @IsOptional()
  @rule('location', (value) => plainTextMessage(typeof value === 'string' ? value.trim() : value, 120), 'Use at most 120 characters.')
  location?: string;

  @IsOptional()
  @Transform(blankLink)
  @rule('githubUrl', optionalHttpUrlMessage, 'Enter a full link starting with https://')
  githubUrl?: string | null;

  @IsOptional()
  @Transform(blankLink)
  @rule('photoUrl', photoUrlMessage, 'Use a JPEG, PNG, or WebP image.')
  photoUrl?: string | null;

  @IsOptional()
  @Transform(blankLink)
  @rule('photoStorageKey', photoStorageKeyMessage, 'Use a JPEG, PNG, or WebP image.')
  photoStorageKey?: string | null;

  @IsOptional()
  @Transform(trimIdList)
  @rule('lessonIds', lessonIdsMessage, 'Choose a class.')
  lessonIds?: string[];

  @IsOptional()
  @rule('consentReceived', consentMessage, 'Choose whether consent was received.')
  consentReceived?: boolean;

  @IsOptional()
  @rule(
    'linksShareConsent',
    linkConsentMessage,
    'Choose whether the trainee agreed to share links.',
  )
  linksShareConsent?: boolean;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('statusLabel', (value) => plainTextMessage(value, 80), 'Use at most 80 characters.')
  statusLabel?: string;

  @IsOptional()
  @rule('internalNotes', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;
}
