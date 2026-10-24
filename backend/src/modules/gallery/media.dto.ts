import { IsOptional, ValidateBy } from 'class-validator';
import {
  albumMessage,
  altMessage,
  captionMessage,
  consentMessage,
  dimensionMessage,
  fileMessage,
  listingMessage,
  publicationMessage,
} from './media.rules.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

/** JSON body for `POST /admin/media` when the form has no file bytes yet. */
export class MediaCreateDto {
  @rule('alt', altMessage, 'Describe the image without naming anyone.')
  alt!: string;

  @IsOptional()
  @rule('caption', captionMessage, 'Use at most 500 characters.')
  caption?: string;

  @IsOptional()
  @rule('album', albumMessage, 'Choose an album.')
  album?: string;

  @IsOptional()
  @rule('file', fileMessage, 'Use a short file name.')
  file?: string;

  @IsOptional()
  @rule('width', dimensionMessage, 'Use a width and height between 1 and 20000.')
  width?: number;

  @IsOptional()
  @rule('height', dimensionMessage, 'Use a width and height between 1 and 20000.')
  height?: number;
}

/** Body for `PATCH /admin/media/:id`. Omitted fields stay as they are. */
export class MediaPatchDto {
  @IsOptional()
  @rule('alt', altMessage, 'Describe the image without naming anyone.')
  alt?: string;

  @IsOptional()
  @rule('caption', captionMessage, 'Use at most 500 characters.')
  caption?: string;

  @IsOptional()
  @rule('album', albumMessage, 'Choose an album.')
  album?: string;

  @IsOptional()
  @rule('consent', consentMessage, 'Choose pending or verified.')
  consent?: 'pending' | 'verified';

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;
}
