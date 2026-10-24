import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { AppEnv } from '../../config/env.js';
import type { AppLogger } from '../logging/logger.js';
import { ApiError, errorBody } from './api-error.js';

interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

export function notFound(): RequestHandler {
  return (_req, _res, next) => {
    next(new ApiError('not_found', 'That route does not exist.'));
  };
}

/**
 * Last middleware. Known API errors keep their code. A bad JSON body becomes
 * validation. Anything else is a generic server error: the client does not
 * receive the exception message or the stack.
 */
export function errorHandler(logger: AppLogger, _env: AppEnv): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    const apiError = toApiError(err);
    if (apiError.code === 'server') {
      logger.error({ requestId: req.id, name: errorName(err) }, 'Request failed');
    }
    res.status(apiError.status).json(errorBody(apiError));
  };
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      return new ApiError('validation', 'The request body is not valid JSON.');
    }
    if (err.type === 'entity.too.large') {
      return new ApiError('validation', 'The request body is too large.');
    }
  }
  return new ApiError('server', 'Something went wrong.');
}

function isBodyParserError(err: unknown): err is BodyParserError {
  if (!(err instanceof SyntaxError) && !(err instanceof Error)) return false;
  const typed = err as BodyParserError;
  const status = typed.status ?? typed.statusCode;
  return typeof typed.type === 'string' && (status === 400 || status === 413);
}

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : 'UnknownError';
}
