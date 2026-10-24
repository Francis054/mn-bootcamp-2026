import { Router, type Request } from 'express';
import { requirePermission } from '../auth/require-auth.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import type { Actor } from '../curriculum/actor.js';
import { EventCreateDto, EventPatchDto } from './event.dto.js';
import type { EventService } from './event.service.js';
import { readEventListQuery } from './list-query.js';

export function mountPublicEvents(router: Router, events: EventService): void {
  router.get('/public/events', (_req, res, next) => {
    events
      .listPublic()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/events/:id', (req, res, next) => {
    events
      .getPublic(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

export function mountAdminEvents(admin: Router, events: EventService): void {
  admin.get('/events', (req, res, next) => {
    try {
      const query = readEventListQuery(req.query);
      events
        .listAdmin(query)
        .then((page) => res.json(page))
        .catch(next);
    } catch (error) {
      next(error);
    }
  });
  admin.post('/events', requirePermission('content.write'), (req, res, next) => {
    validateDto(EventCreateDto, req.body)
      .then((dto) => events.create(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/events/:id', (req, res, next) => {
    events
      .getAdmin(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/events/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(EventPatchDto, req.body)
      .then((dto) => events.update(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/events/:id', requirePermission('content.write'), (req, res, next) => {
    events
      .remove(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/events/:id/publish', requirePermission('content.write'), (req, res, next) => {
    events
      .publish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/events/:id/unpublish', requirePermission('content.write'), (req, res, next) => {
    events
      .unpublish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

function actorFrom(req: Request): Actor {
  return {
    userId: req.user?.id ?? null,
    ip: req.ip ?? null,
    requestId: req.id,
  };
}

function param(req: Request): string {
  const value = req.params.id;
  return typeof value === 'string' ? value : '';
}
