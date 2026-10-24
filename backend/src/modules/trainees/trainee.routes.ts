import { Router, type Request } from 'express';
import { requirePermission } from '../auth/require-auth.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import type { Actor } from '../curriculum/actor.js';
import { TraineeCreateDto, TraineePatchDto } from './trainee.dto.js';
import { readTraineeListQuery } from './list-query.js';
import type { TraineeService } from './trainee.service.js';

export function mountPublicTrainees(router: Router, trainees: TraineeService): void {
  router.get('/public/trainees', (_req, res, next) => {
    trainees
      .listPublic()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/trainees/:id', (req, res, next) => {
    trainees
      .getPublic(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

export function mountAdminTrainees(admin: Router, trainees: TraineeService): void {
  admin.get('/trainees', (req, res, next) => {
    try {
      const query = readTraineeListQuery(req.query);
      trainees
        .listAdmin(query)
        .then((page) => res.json(page))
        .catch(next);
    } catch (error) {
      next(error);
    }
  });
  admin.post('/trainees', requirePermission('content.write'), (req, res, next) => {
    validateDto(TraineeCreateDto, req.body)
      .then((dto) => trainees.create(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/trainees/:id', (req, res, next) => {
    trainees
      .getAdmin(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/trainees/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(TraineePatchDto, req.body)
      .then((dto) => trainees.update(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/trainees/:id', requirePermission('content.write'), (req, res, next) => {
    trainees
      .remove(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/trainees/:id/publish', requirePermission('content.write'), (req, res, next) => {
    trainees
      .publish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/trainees/:id/unpublish', requirePermission('content.write'), (req, res, next) => {
    trainees
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
