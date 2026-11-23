import { IsOptional, ValidateBy } from 'class-validator';
import {
  descriptionMessage,
  displayOrderMessage,
  groupMessage,
  nameMessage,
  publishedMessage,
  reorderIdsMessage,
  titleMessage,
} from './about-person.rules.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

/** Body for `POST /admin/about-people`. Description and title may be left blank. */
export class AboutPersonCreateDto {
  @rule('group', groupMessage, 'Choose Founder, Team, or Partners.')
  group!: string;

  @rule('name', nameMessage, 'Enter a name.')
  name!: string;

  @IsOptional()
  @rule('title', titleMessage, 'Use at most 160 characters.')
  title?: string;

  @IsOptional()
  @rule('description', descriptionMessage, 'Use at most 2000 characters.')
  description?: string;

  @IsOptional()
  @rule('displayOrder', displayOrderMessage, 'Use a whole number from 0 to 10000.')
  displayOrder?: number;

  @IsOptional()
  @rule('published', publishedMessage, 'Choose whether this person is published.')
  published?: boolean;
}

/** Body for `PATCH /admin/about-people/:id`. Every field is optional. */
export class AboutPersonPatchDto {
  @IsOptional()
  @rule('group', groupMessage, 'Choose Founder, Team, or Partners.')
  group?: string;

  @IsOptional()
  @rule('name', nameMessage, 'Enter a name.')
  name?: string;

  @IsOptional()
  @rule('title', titleMessage, 'Use at most 160 characters.')
  title?: string;

  @IsOptional()
  @rule('description', descriptionMessage, 'Use at most 2000 characters.')
  description?: string;

  @IsOptional()
  @rule('displayOrder', displayOrderMessage, 'Use a whole number from 0 to 10000.')
  displayOrder?: number;

  @IsOptional()
  @rule('published', publishedMessage, 'Choose whether this person is published.')
  published?: boolean;
}

/** Body for `POST /admin/about-people/reorder`. */
export class AboutPersonReorderDto {
  @rule('group', groupMessage, 'Choose Founder, Team, or Partners.')
  group!: string;

  @rule('ids', reorderIdsMessage, 'Choose the order.')
  ids!: string[];
}
