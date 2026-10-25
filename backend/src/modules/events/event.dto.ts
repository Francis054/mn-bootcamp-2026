import { Transform } from 'class-transformer';
import { IsOptional, ValidateBy } from 'class-validator';
import { trimIdList } from '../../shared/validation/id-list.js';
import { eventBodyProblem } from './event-types.js';
import {
  booleanMessage,
  clockMessage,
  dateMessage,
  kindMessage,
  lessonIdsMessage,
  listingMessage,
  mediaIdsMessage,
  placeMessage,
  plainTextMessage,
  projectIdsMessage,
  publicationMessage,
  sourceUrlProblem,
  summaryMessage,
  titleMessage,
} from './event.rules.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

const DATE_TBC = 'Choose whether the date is confirmed.';
const VERIFIED = 'Choose whether the event was checked against a source.';
const SAMPLE = 'Choose whether this is a sample milestone.';
const ANNIVERSARY = 'Choose whether the event appears on the anniversary page.';
const CALENDAR = 'Choose whether a calendar file can be downloaded.';

/** Body for `POST /admin/events`. Messages match the event form. */
export class EventCreateDto {
  @rule('title', titleMessage, 'Give the event a name.')
  title!: string;

  @rule('place', placeMessage, 'Enter a venue, or “Venue to be confirmed”.')
  place!: string;

  @rule('summary', summaryMessage, 'Write a summary of at least 20 characters.')
  summary!: string;

  @IsOptional()
  @rule('date', dateMessage, 'Pick a date.')
  date?: string;

  @IsOptional()
  @rule('dateTbc', (value) => booleanMessage(value, DATE_TBC), DATE_TBC)
  dateTbc?: boolean;

  @IsOptional()
  @rule('whenLabel', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  whenLabel?: string;

  @IsOptional()
  @rule('kind', kindMessage, 'Choose a kind.')
  kind?: string;

  @IsOptional()
  @rule('verified', (value) => booleanMessage(value, VERIFIED), VERIFIED)
  verified?: boolean;

  @IsOptional()
  @rule('sample', (value) => booleanMessage(value, SAMPLE), SAMPLE)
  sample?: boolean;

  @IsOptional()
  @rule('body', eventBodyProblem, 'Write the event body.')
  body?: unknown;

  @IsOptional()
  @rule('source', (value) => plainTextMessage(value, 500), 'Use at most 500 characters.')
  source?: string;

  @IsOptional()
  @rule('sourceUrl', sourceUrlProblem, 'Enter a full link starting with https://')
  sourceUrl?: string;

  @IsOptional()
  @rule('image', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  image?: string;

  @IsOptional()
  @rule('showOnAnniversary', (value) => booleanMessage(value, ANNIVERSARY), ANNIVERSARY)
  showOnAnniversary?: boolean;

  @IsOptional()
  @rule('calendarDownload', (value) => booleanMessage(value, CALENDAR), CALENDAR)
  calendarDownload?: boolean;

  @IsOptional()
  @rule('startTime', clockMessage, 'Use 24-hour time, like 17:00.')
  startTime?: string;

  @IsOptional()
  @rule('endTime', clockMessage, 'Use 24-hour time, like 17:00.')
  endTime?: string;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;

  @IsOptional()
  @rule('internalNotes', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;

  @IsOptional()
  @Transform(trimIdList)
  @rule('lessonIds', lessonIdsMessage, 'Choose a class.')
  lessonIds?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('projectIds', projectIdsMessage, 'Choose a project.')
  projectIds?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('mediaIds', mediaIdsMessage, 'Choose a photo.')
  mediaIds?: string[];
}

/** Body for `PATCH /admin/events/:id`. Omitted fields stay as they are. */
export class EventPatchDto {
  @IsOptional()
  @rule('title', titleMessage, 'Give the event a name.')
  title?: string;

  @IsOptional()
  @rule('place', placeMessage, 'Enter a venue, or “Venue to be confirmed”.')
  place?: string;

  @IsOptional()
  @rule('summary', summaryMessage, 'Write a summary of at least 20 characters.')
  summary?: string;

  @IsOptional()
  @rule('date', dateMessage, 'Pick a date.')
  date?: string;

  @IsOptional()
  @rule('dateTbc', (value) => booleanMessage(value, DATE_TBC), DATE_TBC)
  dateTbc?: boolean;

  @IsOptional()
  @rule('whenLabel', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  whenLabel?: string;

  @IsOptional()
  @rule('kind', kindMessage, 'Choose a kind.')
  kind?: string;

  @IsOptional()
  @rule('verified', (value) => booleanMessage(value, VERIFIED), VERIFIED)
  verified?: boolean;

  @IsOptional()
  @rule('sample', (value) => booleanMessage(value, SAMPLE), SAMPLE)
  sample?: boolean;

  @IsOptional()
  @rule('body', eventBodyProblem, 'Write the event body.')
  body?: unknown;

  @IsOptional()
  @rule('source', (value) => plainTextMessage(value, 500), 'Use at most 500 characters.')
  source?: string;

  @IsOptional()
  @rule('sourceUrl', sourceUrlProblem, 'Enter a full link starting with https://')
  sourceUrl?: string;

  @IsOptional()
  @rule('image', (value) => plainTextMessage(value, 200), 'Use at most 200 characters.')
  image?: string;

  @IsOptional()
  @rule('showOnAnniversary', (value) => booleanMessage(value, ANNIVERSARY), ANNIVERSARY)
  showOnAnniversary?: boolean;

  @IsOptional()
  @rule('calendarDownload', (value) => booleanMessage(value, CALENDAR), CALENDAR)
  calendarDownload?: boolean;

  @IsOptional()
  @rule('startTime', clockMessage, 'Use 24-hour time, like 17:00.')
  startTime?: string;

  @IsOptional()
  @rule('endTime', clockMessage, 'Use 24-hour time, like 17:00.')
  endTime?: string;

  @IsOptional()
  @rule('publicationStatus', publicationMessage, 'Choose a workflow state.')
  publicationStatus?: string;

  @IsOptional()
  @rule('listing', listingMessage, 'Choose a listing.')
  listing?: string;

  @IsOptional()
  @rule('internalNotes', (value) => plainTextMessage(value, 5000), 'Use at most 5000 characters.')
  internalNotes?: string;

  @IsOptional()
  @Transform(trimIdList)
  @rule('lessonIds', lessonIdsMessage, 'Choose a class.')
  lessonIds?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('projectIds', projectIdsMessage, 'Choose a project.')
  projectIds?: string[];

  @IsOptional()
  @Transform(trimIdList)
  @rule('mediaIds', mediaIdsMessage, 'Choose a photo.')
  mediaIds?: string[];
}
