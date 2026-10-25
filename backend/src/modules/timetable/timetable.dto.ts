import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SESSION_TYPES, TRAINER_STATUSES } from './model.js';

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const CLOCK = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null) return undefined;
  return value;
}

export class BlockWriteDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  professionalismTheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cybersecurityTheme?: string;
}

export class WeekWriteDto {
  @IsString()
  @MaxLength(64)
  blockId!: string;

  @IsInt()
  @Min(1)
  @Max(24)
  number!: number;

  @IsString()
  @MaxLength(200)
  title!: string;

  @Matches(DATE, { message: 'Use a date as YYYY-MM-DD.' })
  startsOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  professionalism?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  cybersecurity?: string;
}

export class WeekPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  blockId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DATE, { message: 'Use a date as YYYY-MM-DD.' })
  startsOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  professionalism?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  cybersecurity?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  deliverables?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  professionalismTrainerIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  cybersecurityTrainerIds?: string[];
}

export class SessionWriteDto {
  @IsString()
  @MaxLength(64)
  weekId!: string;

  @Matches(DATE, { message: 'Use a date as YYYY-MM-DD.' })
  date!: string;

  @IsIn(SESSION_TYPES)
  type!: (typeof SESSION_TYPES)[number];

  @IsString()
  @MaxLength(200)
  activity!: string;

  @IsString()
  @MaxLength(8000)
  topic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(CLOCK, { message: 'Use a time as HH:MM.' })
  startTime?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(CLOCK, { message: 'Use a time as HH:MM.' })
  endTime?: string;

  @IsOptional()
  @IsIn(TRAINER_STATUSES)
  trainerStatus?: (typeof TRAINER_STATUSES)[number];

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  trainerIds!: string[];
}

export class ReorderSessionDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}

export class TrainerPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  proposed?: boolean;
}
