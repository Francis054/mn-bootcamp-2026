import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const INCOMING_ID = /^[A-Za-z0-9._-]{1,80}$/;

/** Keep a caller-supplied id when it is a short token, otherwise mint one. */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    const id = incoming && INCOMING_ID.test(incoming) ? incoming : randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
