import { altMessage, captionMessage, imageSizeMessage } from '../gallery/media.rules.js';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export { altMessage, captionMessage, imageSizeMessage };

export function traineeIdMessage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !ID.test(value.trim())) return 'Choose a trainee.';
  return undefined;
}

/** An empty value means the photo is not tied to a project. */
export function projectIdMessage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !ID.test(value.trim())) return 'Choose a project.';
  return undefined;
}
