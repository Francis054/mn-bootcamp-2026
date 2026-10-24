import { isListing, isPublicationStatus } from '../curriculum/publication.js';
import { projectUrlProblem } from './project-url.js';
import { isProjectType } from './project-types.js';

export function titleMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Give the project a title.';
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Give the project a title.';
  if (trimmed.length < 6) return 'Use at least 6 characters.';
  if (trimmed.length > 200) return 'Use at most 200 characters.';
  return undefined;
}

export function typeMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isProjectType(value.trim())) return 'Choose a type.';
  return undefined;
}

export function abstractMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'Write an abstract of at least 30 characters.';
  const trimmed = value.trim();
  if (trimmed.length < 30) return 'Use at least 30 characters.';
  if (trimmed.length > 5000) return 'Use at most 5000 characters.';
  return undefined;
}

export function moduleIdMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value.trim())) {
    return 'Choose a module.';
  }
  return undefined;
}

export function stepsMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return 'Enter one step per line.';
  }
  if (value.length > 20) return 'Use at most 20 steps.';
  if (value.some((item: string) => item.length > 300)) {
    return 'Use at most 300 characters for each step.';
  }
  return undefined;
}

export function teamMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return 'Enter the team as a list.';
  }
  if (value.length > 20) return 'Use at most 20 names.';
  if (value.some((item: string) => item.length > 120)) {
    return 'Use at most 120 characters for each name.';
  }
  return undefined;
}

export function traineeIdsMessage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return 'Choose a trainee.';
  }
  if (value.length > 20) return 'Choose at most 20 trainees.';
  if (value.some((item: string) => !/^[A-Za-z0-9-]{1,64}$/.test(item))) return 'Choose a trainee.';
  return undefined;
}

export function plainTextMessage(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return 'Use plain text.';
  if (value.length > max) return `Use at most ${max} characters.`;
  return undefined;
}

export function booleanMessage(value: unknown, sentence: string): string | undefined {
  if (typeof value !== 'boolean') return sentence;
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

export { projectUrlProblem };
