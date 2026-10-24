import { Router, type Request } from 'express';
import { requirePermission } from '../auth/require-auth.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import type { Actor } from '../curriculum/actor.js';
import { readProjectListQuery } from './list-query.js';
import { ProjectCreateDto, ProjectPatchDto } from './project.dto.js';
import type { ProjectService } from './project.service.js';

export function mountPublicProjects(router: Router, projects: ProjectService): void {
  router.get('/public/projects', (_req, res, next) => {
    projects
      .listPublic()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/projects/:id', (req, res, next) => {
    projects
      .getPublic(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

export function mountAdminProjects(admin: Router, projects: ProjectService): void {
  admin.get('/projects', (req, res, next) => {
    try {
      const query = readProjectListQuery(req.query);
      projects
        .listAdmin(query)
        .then((page) => res.json(page))
        .catch(next);
    } catch (error) {
      next(error);
    }
  });
  admin.post('/projects', requirePermission('content.write'), (req, res, next) => {
    validateDto(ProjectCreateDto, req.body)
      .then((dto) => projects.create(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/projects/:id', (req, res, next) => {
    projects
      .getAdmin(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/projects/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(ProjectPatchDto, req.body)
      .then((dto) => projects.update(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/projects/:id', requirePermission('content.write'), (req, res, next) => {
    projects
      .remove(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/projects/:id/publish', requirePermission('content.write'), (req, res, next) => {
    projects
      .publish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/projects/:id/unpublish', requirePermission('content.write'), (req, res, next) => {
    projects
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
