import { Transform } from 'class-transformer';
import { IsOptional, ValidateBy } from 'class-validator';
import {
  abstractMessage,
  booleanMessage,
  listingMessage,
  moduleIdMessage,
  plainTextMessage,
  projectUrlProblem,
  publicationMessage,
  stepsMessage,
  teamMessage,
  titleMessage,
  lessonIdsMessage,
  traineeIdsMessage,
  typeMessage,
} from './project.rules.js';
import { trimIdList } from '../../shared/validation/id-list.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

function lines({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return value;
  return value.map((item: string) => item.trim()).filter((item) => item.length > 0);
}

const LAB = 'Choose whether the work stayed in the lab.';
const SHARE = 'Choose whether the team agreed to share links.';

/** Body for `POST /admin/projects`. Messages match the project form. */
export class ProjectCreateDto {
  @rule('title', titleMessage, 'Give the project a title.')
  title!: string;

  @rule('type', typeMessage, 'Choose a type.')
  type!: string;

  @rule('abstract', abstractMessage, 'Write an abstract of at least 30 characters.')
  abstract!: string;

  @rule('moduleId', moduleIdMessage, 'Choose a module.')
  moduleId!: string;

  @IsOptional()
  @rule('slug', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  slug?: string;

  @IsOptional()
  @rule('cover', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  cover?: string;

  @IsOptional()
  @rule('image', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  image?: string;

  @IsOptional()
  @rule('tools', (value) => plainTextMessage(value, 500), 'Use at most 500 characters.')
  tools?: string;

  @IsOptional()
  @Transform(lines)
  @rule('steps', stepsMessage, 'Enter one step per line.')
  steps?: string[];

  @IsOptional()
  @Transform(lines)
  @rule('team', teamMessage, 'Enter the team as a list.')
  team?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('traineeIds', traineeIdsMessage, 'Choose a trainee.')
  traineeIds?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('lessonIds', lessonIdsMessage, 'Choose a class.')
  lessonIds?: string[];

  @IsOptional()
  @rule('repositoryUrl', projectUrlProblem, 'Enter a full link starting with https://.')
  repositoryUrl?: string;

  @IsOptional()
  @rule('demoUrl', projectUrlProblem, 'Enter a full link starting with https://.')
  demoUrl?: string;

  @IsOptional()
  @rule('labOnlyConfirmed', (value) => booleanMessage(value, LAB), LAB)
  labOnlyConfirmed?: boolean;

  @IsOptional()
  @rule('shareAgreed', (value) => booleanMessage(value, SHARE), SHARE)
  shareAgreed?: boolean;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;

  @IsOptional()
  @rule('internalNotes', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;
}

/** Body for `PATCH /admin/projects/:id`. Omitted fields stay as they are. */
export class ProjectPatchDto {
  @IsOptional()
  @rule('title', titleMessage, 'Give the project a title.')
  title?: string;

  @IsOptional()
  @rule('type', typeMessage, 'Choose a type.')
  type?: string;

  @IsOptional()
  @rule('abstract', abstractMessage, 'Write an abstract of at least 30 characters.')
  abstract?: string;

  @IsOptional()
  @rule('moduleId', moduleIdMessage, 'Choose a module.')
  moduleId?: string;

  @IsOptional()
  @rule('slug', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  slug?: string;

  @IsOptional()
  @rule('cover', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  cover?: string;

  @IsOptional()
  @rule('image', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  image?: string;

  @IsOptional()
  @rule('tools', (value) => plainTextMessage(value, 500), 'Use at most 500 characters.')
  tools?: string;

  @IsOptional()
  @Transform(lines)
  @rule('steps', stepsMessage, 'Enter one step per line.')
  steps?: string[];

  @IsOptional()
  @Transform(lines)
  @rule('team', teamMessage, 'Enter the team as a list.')
  team?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('traineeIds', traineeIdsMessage, 'Choose a trainee.')
  traineeIds?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('lessonIds', lessonIdsMessage, 'Choose a class.')
  lessonIds?: string[];

  @IsOptional()
  @rule('repositoryUrl', projectUrlProblem, 'Enter a full link starting with https://.')
  repositoryUrl?: string;

  @IsOptional()
  @rule('demoUrl', projectUrlProblem, 'Enter a full link starting with https://.')
  demoUrl?: string;

  @IsOptional()
  @rule('labOnlyConfirmed', (value) => booleanMessage(value, LAB), LAB)
  labOnlyConfirmed?: boolean;

  @IsOptional()
  @rule('shareAgreed', (value) => booleanMessage(value, SHARE), SHARE)
  shareAgreed?: boolean;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;

  @IsOptional()
  @rule('internalNotes', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;
}
