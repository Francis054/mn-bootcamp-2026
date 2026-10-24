import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { ApiError } from '../errors/api-error.js';

/**
 * Turn a JSON value into a class instance and reject it unless every decorated
 * rule passes. Extra properties are rejected rather than silently dropped.
 */
export async function validateDto<T extends object>(
  cls: new () => T,
  payload: unknown,
): Promise<T> {
  const dto = plainToInstance(cls, payload);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    throw new ApiError('validation', 'Check the highlighted fields.', fieldErrorsFrom(errors));
  }
  return dto;
}

function fieldErrorsFrom(errors: ValidationError[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const error of errors) {
    const message = firstConstraint(error);
    if (message) fieldErrors[error.property] = message;
  }
  return fieldErrors;
}

function firstConstraint(error: ValidationError): string | undefined {
  if (!error.constraints) return undefined;
  const messages = Object.values(error.constraints);
  return messages[0];
}
