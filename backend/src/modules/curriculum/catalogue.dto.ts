import { Transform } from 'class-transformer';
import { IsOptional, ValidateBy } from 'class-validator';
import { isCatalogueId } from './slug.js';
import { listingMessage, publicationMessage } from './lesson.rules.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

export function nameMessage(value: unknown, empty: string, max = 80): string | undefined {
  if (typeof value !== 'string') return empty;
  const trimmed = value.trim();
  if (trimmed.length === 0) return empty;
  if (trimmed.length > max) return `Use at most ${max} characters.`;
  return undefined;
}

export function summaryMessage(value: unknown, empty: string): string | undefined {
  if (typeof value !== 'string') return empty;
  const trimmed = value.trim();
  if (trimmed.length === 0) return empty;
  if (trimmed.length < 20) return 'Use at least 20 characters.';
  if (trimmed.length > 2000) return 'Use at most 2000 characters.';
  return undefined;
}

function idMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isCatalogueId(value.trim())) {
    return 'Use a short id made of lowercase letters, numbers, and hyphens.';
  }
  return undefined;
}

function iconMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,40}$/.test(value.trim())) {
    return 'Choose an icon name.';
  }
  return undefined;
}

function sortMessage(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 999) {
    return 'Use a sort order from 0 to 999.';
  }
  return undefined;
}

function phaseIdMessage(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 9) {
    return 'Enter a phase number from 1 to 9.';
  }
  return undefined;
}

function moduleIdsMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return 'Choose the modules in this phase.';
  }
  if (value.length > 12) return 'Choose at most 12 modules.';
  if (value.some((item: string) => !isCatalogueId(item))) {
    return 'Choose a module that exists.';
  }
  return undefined;
}

function wholeNumber({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) return Number(value.trim());
  return value;
}

export class TrackWriteDto {
  @IsOptional()
  @rule('id', idMessage, 'Use a short id made of lowercase letters, numbers, and hyphens.')
  id?: string;

  @rule('name', (value) => nameMessage(value, 'Give the track a name.'), 'Give the track a name.')
  name!: string;

  @rule(
    'summary',
    (value) => summaryMessage(value, 'Write a short summary.'),
    'Write a short summary.',
  )
  summary!: string;

  @IsOptional()
  @Transform(wholeNumber)
  @rule('sortOrder', sortMessage, 'Use a sort order from 0 to 999.')
  sortOrder?: number;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}

export class TrackPatchDto {
  @IsOptional()
  @rule('name', (value) => nameMessage(value, 'Give the track a name.'), 'Give the track a name.')
  name?: string;

  @IsOptional()
  @rule(
    'summary',
    (value) => summaryMessage(value, 'Write a short summary.'),
    'Write a short summary.',
  )
  summary?: string;

  @IsOptional()
  @Transform(wholeNumber)
  @rule('sortOrder', sortMessage, 'Use a sort order from 0 to 999.')
  sortOrder?: number;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}

export class ModuleWriteDto {
  @IsOptional()
  @rule('id', idMessage, 'Use a short id made of lowercase letters, numbers, and hyphens.')
  id?: string;

  @rule(
    'name',
    (value) => nameMessage(value, 'Give the module a name.', 120),
    'Give the module a name.',
  )
  name!: string;

  @rule(
    'short',
    (value) => nameMessage(value, 'Give the module a short name.', 40),
    'Give the module a short name.',
  )
  short!: string;

  @rule('icon', iconMessage, 'Choose an icon name.')
  icon!: string;

  @rule(
    'summary',
    (value) => summaryMessage(value, 'Write a short summary.'),
    'Write a short summary.',
  )
  summary!: string;

  @IsOptional()
  @Transform(wholeNumber)
  @rule('sortOrder', sortMessage, 'Use a sort order from 0 to 999.')
  sortOrder?: number;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}

export class ModulePatchDto {
  @IsOptional()
  @rule(
    'name',
    (value) => nameMessage(value, 'Give the module a name.', 120),
    'Give the module a name.',
  )
  name?: string;

  @IsOptional()
  @rule(
    'short',
    (value) => nameMessage(value, 'Give the module a short name.', 40),
    'Give the module a short name.',
  )
  short?: string;

  @IsOptional()
  @rule('icon', iconMessage, 'Choose an icon name.')
  icon?: string;

  @IsOptional()
  @rule(
    'summary',
    (value) => summaryMessage(value, 'Write a short summary.'),
    'Write a short summary.',
  )
  summary?: string;

  @IsOptional()
  @Transform(wholeNumber)
  @rule('sortOrder', sortMessage, 'Use a sort order from 0 to 999.')
  sortOrder?: number;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}

export class PhaseWriteDto {
  @Transform(wholeNumber)
  @rule('id', phaseIdMessage, 'Enter a phase number from 1 to 9.')
  id!: number;

  @rule('name', (value) => nameMessage(value, 'Give the phase a name.'), 'Give the phase a name.')
  name!: string;

  @rule(
    'months',
    (value) => nameMessage(value, 'Say which months this phase covers.'),
    'Say which months this phase covers.',
  )
  months!: string;

  @rule(
    'summary',
    (value) => summaryMessage(value, 'Write a short summary.'),
    'Write a short summary.',
  )
  summary!: string;

  @rule('moduleIds', moduleIdsMessage, 'Choose the modules in this phase.')
  moduleIds!: string[];

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}

export class PhasePatchDto {
  @IsOptional()
  @rule('name', (value) => nameMessage(value, 'Give the phase a name.'), 'Give the phase a name.')
  name?: string;

  @IsOptional()
  @rule(
    'months',
    (value) => nameMessage(value, 'Say which months this phase covers.'),
    'Say which months this phase covers.',
  )
  months?: string;

  @IsOptional()
  @rule(
    'summary',
    (value) => summaryMessage(value, 'Write a short summary.'),
    'Write a short summary.',
  )
  summary?: string;

  @IsOptional()
  @rule('moduleIds', moduleIdsMessage, 'Choose the modules in this phase.')
  moduleIds?: string[];

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}

export class BulkClassesDto {
  @rule('ids', idsMessage, 'Select at least one row.')
  ids!: string[];

  @rule('action', actionMessage, 'Choose publish or delete.')
  action!: 'publish' | 'delete';
}

function idsMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return 'Select at least one row.';
  if (value.length > 100) return 'Select at most 100 rows.';
  if (value.some((item) => typeof item !== 'string' || item.length === 0 || item.length > 64)) {
    return 'Select at least one row.';
  }
  return undefined;
}

function actionMessage(value: unknown): string | undefined {
  if (value !== 'publish' && value !== 'delete') return 'Choose publish or delete.';
  return undefined;
}
