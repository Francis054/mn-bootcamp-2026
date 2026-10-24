import { isListing, isPublicationStatus } from './publication.js';

const TITLE = {
  empty: 'Give the class a title.',
  min: 6,
  short: 'Use at least 6 characters.',
  max: 200,
};
const SUMMARY = {
  empty: 'Write a short summary for the class card.',
  min: 20,
  short: 'Use at least 20 characters.',
  max: 2000,
};

export function titleMessage(value: unknown): string | undefined {
  return boundedText(value, TITLE);
}

export function summaryMessage(value: unknown): string | undefined {
  return boundedText(value, SUMMARY);
}

export function moduleIdMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return 'Choose a module.';
  if (value.trim().length > 40) return 'Choose a module.';
  return undefined;
}

export function weekMessage(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 18) {
    return 'Enter a week from 1 to 18.';
  }
  return undefined;
}

export function dateMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Pick a date.';
  return dateProblem(value.trim());
}

export function dateProblem(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Pick a date.';
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return 'Pick a date.';
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return 'Pick a date.';
  }
  return undefined;
}

export function lengthMessage(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.length > max) return `Use at most ${max} characters.`;
  return undefined;
}

export function objectivesMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return 'Enter one objective per line.';
  }
  const lines = value.map((item: string) => item.trim()).filter((item) => item.length > 0);
  if (lines.length > 20) return 'Use at most 20 objectives.';
  if (lines.some((line) => line.length > 300)) {
    return 'Use at most 300 characters for each objective.';
  }
  return undefined;
}

export function publicationMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isPublicationStatus(value)) return 'Choose a workflow state.';
  return undefined;
}

export function listingMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isListing(value)) return 'Choose a listing.';
  return undefined;
}

export function lessonFieldErrors(input: {
  title: string;
  moduleId: string;
  week: number;
  date: string;
  summary: string;
  slug?: string;
  format?: string;
  room?: string;
  objectives?: string[];
  lab?: string;
  codeSample?: string;
  cover?: string;
  internalNotes?: string;
  publicationStatus?: string;
  listing?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  assign(errors, 'title', titleMessage(input.title));
  assign(errors, 'moduleId', moduleIdMessage(input.moduleId));
  assign(errors, 'week', weekMessage(input.week));
  assign(errors, 'date', dateMessage(input.date));
  assign(errors, 'summary', summaryMessage(input.summary));
  if (input.slug !== undefined) assign(errors, 'slug', lengthMessage(input.slug, 200));
  if (input.format !== undefined) assign(errors, 'format', lengthMessage(input.format, 80));
  if (input.room !== undefined) assign(errors, 'room', lengthMessage(input.room, 200));
  if (input.lab !== undefined) assign(errors, 'lab', lengthMessage(input.lab, 5000));
  if (input.codeSample !== undefined)
    assign(errors, 'codeSample', lengthMessage(input.codeSample, 5000));
  if (input.cover !== undefined) assign(errors, 'cover', lengthMessage(input.cover, 200));
  if (input.internalNotes !== undefined) {
    assign(errors, 'internalNotes', lengthMessage(input.internalNotes, 5000));
  }
  if (input.objectives !== undefined)
    assign(errors, 'objectives', objectivesMessage(input.objectives));
  if (input.publicationStatus !== undefined) {
    assign(errors, 'publicationStatus', publicationMessage(input.publicationStatus));
  }
  if (input.listing !== undefined) assign(errors, 'listing', listingMessage(input.listing));
  return errors;
}

function assign(errors: Record<string, string>, key: string, message: string | undefined): void {
  if (message) errors[key] = message;
}

function boundedText(
  value: unknown,
  limits: { empty: string; min: number; short: string; max: number },
): string | undefined {
  if (typeof value !== 'string') return limits.empty;
  const trimmed = value.trim();
  if (trimmed.length === 0) return limits.empty;
  if (trimmed.length < limits.min) return limits.short;
  if (trimmed.length > limits.max) return `Use at most ${limits.max} characters.`;
  return undefined;
}
