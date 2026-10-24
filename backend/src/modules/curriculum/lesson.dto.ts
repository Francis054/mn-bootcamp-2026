import { Transform } from 'class-transformer';
import { IsOptional, ValidateBy } from 'class-validator';
import {
  dateMessage,
  lengthMessage,
  listingMessage,
  moduleIdMessage,
  objectivesMessage,
  publicationMessage,
  summaryMessage,
  titleMessage,
  weekMessage,
} from './lesson.rules.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

function weekTransform({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) return Number(value.trim());
  return value;
}

function objectiveTransform({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return value;
  return value.map((item: string) => item.trim()).filter((item) => item.length > 0);
}

/** Body for `POST /admin/classes`. Messages match the class form. */
export class LessonCreateDto {
  @rule('title', titleMessage, 'Give the class a title.')
  title!: string;

  @rule('moduleId', moduleIdMessage, 'Choose a module.')
  moduleId!: string;

  @Transform(weekTransform)
  @rule('week', weekMessage, 'Enter a week from 1 to 18.')
  week!: number;

  @rule('date', dateMessage, 'Pick a date.')
  date!: string;

  @rule('summary', summaryMessage, 'Write a short summary for the class card.')
  summary!: string;

  @IsOptional()
  @rule('slug', (value) => lengthMessage(value, 200), 'Use at most 200 characters.')
  slug?: string;

  @IsOptional()
  @rule('format', (value) => lengthMessage(value, 80), 'Use at most 80 characters.')
  format?: string;

  @IsOptional()
  @rule('room', (value) => lengthMessage(value, 200), 'Use at most 200 characters.')
  room?: string;

  @IsOptional()
  @Transform(objectiveTransform)
  @rule('objectives', objectivesMessage, 'Enter one objective per line.')
  objectives?: string[];

  @IsOptional()
  @rule('lab', (value) => lengthMessage(value, 5000), 'Use at most 5000 characters.')
  lab?: string;

  @IsOptional()
  @rule('codeSample', (value) => lengthMessage(value, 5000), 'Use at most 5000 characters.')
  codeSample?: string;

  @IsOptional()
  @rule('cover', (value) => lengthMessage(value, 200), 'Use at most 200 characters.')
  cover?: string;

  @IsOptional()
  @rule('internalNotes', (value) => lengthMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}

/** Body for `PATCH /admin/classes/:id`. Omitted fields stay as they are. */
export class LessonPatchDto {
  @IsOptional()
  @rule('title', titleMessage, 'Give the class a title.')
  title?: string;

  @IsOptional()
  @rule('moduleId', moduleIdMessage, 'Choose a module.')
  moduleId?: string;

  @IsOptional()
  @Transform(weekTransform)
  @rule('week', weekMessage, 'Enter a week from 1 to 18.')
  week?: number;

  @IsOptional()
  @rule('date', dateMessage, 'Pick a date.')
  date?: string;

  @IsOptional()
  @rule('summary', summaryMessage, 'Write a short summary for the class card.')
  summary?: string;

  @IsOptional()
  @rule('slug', (value) => lengthMessage(value, 200), 'Use at most 200 characters.')
  slug?: string;

  @IsOptional()
  @rule('format', (value) => lengthMessage(value, 80), 'Use at most 80 characters.')
  format?: string;

  @IsOptional()
  @rule('room', (value) => lengthMessage(value, 200), 'Use at most 200 characters.')
  room?: string;

  @IsOptional()
  @Transform(objectiveTransform)
  @rule('objectives', objectivesMessage, 'Enter one objective per line.')
  objectives?: string[];

  @IsOptional()
  @rule('lab', (value) => lengthMessage(value, 5000), 'Use at most 5000 characters.')
  lab?: string;

  @IsOptional()
  @rule('codeSample', (value) => lengthMessage(value, 5000), 'Use at most 5000 characters.')
  codeSample?: string;

  @IsOptional()
  @rule('cover', (value) => lengthMessage(value, 200), 'Use at most 200 characters.')
  cover?: string;

  @IsOptional()
  @rule('internalNotes', (value) => lengthMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}
