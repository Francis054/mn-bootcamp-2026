import { Router, type Request } from 'express';
import type { SessionService } from '../auth/session.service.js';
import { requireAuth, requirePermission } from '../auth/require-auth.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import type { Actor } from './actor.js';
import type { CatalogueService } from './catalogue.service.js';
import {
  BulkClassesDto,
  ModulePatchDto,
  ModuleWriteDto,
  PhasePatchDto,
  PhaseWriteDto,
  TrackPatchDto,
  TrackWriteDto,
} from './catalogue.dto.js';
import { LessonCreateDto, LessonPatchDto } from './lesson.dto.js';
import type { LessonService } from './lesson.service.js';
import { readLessonListQuery } from './list-query.js';
import { mountAdminContent, mountPublicContent } from '../content/content.routes.js';
import type { ContentService } from '../content/content.service.js';
import { mountAdminEvents, mountPublicEvents } from '../events/event.routes.js';
import type { EventService } from '../events/event.service.js';
import { mountAdminMedia, mountPublicMedia } from '../gallery/media.routes.js';
import type { MediaService } from '../gallery/media.service.js';
import { mountAdminProjects, mountPublicProjects } from '../projects/project.routes.js';
import type { ProjectService } from '../projects/project.service.js';
import { mountAdminTrainees, mountPublicTrainees } from '../trainees/trainee.routes.js';
import type { TraineeService } from '../trainees/trainee.service.js';

export function curriculumRouter(
  catalogue: CatalogueService,
  lessons: LessonService,
  trainees: TraineeService,
  projects: ProjectService,
  events: EventService,
  media: MediaService,
  maxBytes: number,
  content: ContentService,
  sessions: SessionService,
): Router {
  const router = Router();

  router.get('/public/tracks', (_req, res, next) => {
    catalogue
      .listPublicTracks()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/tracks/:id', (req, res, next) => {
    catalogue
      .getPublicTrack(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  router.get('/public/modules', (_req, res, next) => {
    catalogue
      .listPublicModules()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/modules/:id', (req, res, next) => {
    catalogue
      .getPublicModule(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  router.get('/public/phases', (_req, res, next) => {
    catalogue
      .listPublicPhases()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/phases/:id', (req, res, next) => {
    const id = phaseParam(req);
    if (id === undefined) {
      res.status(404).json({
        error: { code: 'not_found', message: 'That page is not available.' },
      });
      return;
    }
    catalogue
      .getPublicPhase(id)
      .then((row) => res.json(row))
      .catch(next);
  });
  router.get('/public/classes', (_req, res, next) => {
    lessons
      .listPublic()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/classes/:id', (req, res, next) => {
    lessons
      .getPublic(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  mountPublicTrainees(router, trainees);
  mountPublicProjects(router, projects);
  mountPublicEvents(router, events);
  mountPublicMedia(router, media);
  mountPublicContent(router, content);

  const admin = Router();
  admin.use(requireAuth(sessions), requirePermission('content.read'));
  mountTracks(admin, catalogue);
  mountModules(admin, catalogue);
  mountPhases(admin, catalogue);
  mountClasses(admin, lessons);
  mountAdminTrainees(admin, trainees);
  mountAdminProjects(admin, projects);
  mountAdminEvents(admin, events);
  mountAdminMedia(admin, media, maxBytes);
  mountAdminContent(admin, content);
  router.use('/admin', admin);
  return router;
}

function mountTracks(admin: Router, catalogue: CatalogueService): void {
  admin.get('/tracks', (_req, res, next) => {
    catalogue
      .listTracks()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.post('/tracks', requirePermission('content.write'), (req, res, next) => {
    validateDto(TrackWriteDto, req.body)
      .then((dto) => catalogue.createTrack(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/tracks/:id', (req, res, next) => {
    catalogue
      .getTrack(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/tracks/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(TrackPatchDto, req.body)
      .then((dto) => catalogue.updateTrack(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/tracks/:id', requirePermission('content.write'), (req, res, next) => {
    catalogue
      .deleteTrack(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/tracks/:id/publish', requirePermission('content.write'), (req, res, next) => {
    catalogue
      .publishTrack(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/tracks/:id/unpublish', requirePermission('content.write'), (req, res, next) => {
    catalogue
      .unpublishTrack(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

function mountModules(admin: Router, catalogue: CatalogueService): void {
  admin.get('/modules', (_req, res, next) => {
    catalogue
      .listModules()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.post('/modules', requirePermission('content.write'), (req, res, next) => {
    validateDto(ModuleWriteDto, req.body)
      .then((dto) => catalogue.createModule(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/modules/:id', (req, res, next) => {
    catalogue
      .getModule(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/modules/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(ModulePatchDto, req.body)
      .then((dto) => catalogue.updateModule(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/modules/:id', requirePermission('content.write'), (req, res, next) => {
    catalogue
      .deleteModule(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/modules/:id/publish', requirePermission('content.write'), (req, res, next) => {
    catalogue
      .publishModule(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/modules/:id/unpublish', requirePermission('content.write'), (req, res, next) => {
    catalogue
      .unpublishModule(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

function mountPhases(admin: Router, catalogue: CatalogueService): void {
  admin.get('/phases', (_req, res, next) => {
    catalogue
      .listPhases()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.post('/phases', requirePermission('content.write'), (req, res, next) => {
    validateDto(PhaseWriteDto, req.body)
      .then((dto) => catalogue.createPhase(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/phases/:id', (req, res, next) => {
    const id = phaseParam(req);
    if (id === undefined) {
      res.status(404).json({ error: { code: 'not_found', message: 'Phase not found.' } });
      return;
    }
    catalogue
      .getPhase(id)
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/phases/:id', requirePermission('content.write'), (req, res, next) => {
    const id = phaseParam(req);
    if (id === undefined) {
      res.status(404).json({ error: { code: 'not_found', message: 'Phase not found.' } });
      return;
    }
    validateDto(PhasePatchDto, req.body)
      .then((dto) => catalogue.updatePhase(id, dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/phases/:id', requirePermission('content.write'), (req, res, next) => {
    const id = phaseParam(req);
    if (id === undefined) {
      res.status(404).json({ error: { code: 'not_found', message: 'Phase not found.' } });
      return;
    }
    catalogue
      .deletePhase(id, actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/phases/:id/publish', requirePermission('content.write'), (req, res, next) => {
    const id = phaseParam(req);
    if (id === undefined) {
      res.status(404).json({ error: { code: 'not_found', message: 'Phase not found.' } });
      return;
    }
    catalogue
      .publishPhase(id, actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/phases/:id/unpublish', requirePermission('content.write'), (req, res, next) => {
    const id = phaseParam(req);
    if (id === undefined) {
      res.status(404).json({ error: { code: 'not_found', message: 'Phase not found.' } });
      return;
    }
    catalogue
      .unpublishPhase(id, actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

function mountClasses(admin: Router, lessons: LessonService): void {
  admin.get('/classes', (req, res, next) => {
    try {
      const query = readLessonListQuery(req.query);
      lessons
        .listAdmin(query)
        .then((page) => res.json(page))
        .catch(next);
    } catch (error) {
      next(error);
    }
  });
  admin.post('/classes', requirePermission('content.write'), (req, res, next) => {
    validateDto(LessonCreateDto, req.body)
      .then((dto) => lessons.create(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.post('/classes/bulk', requirePermission('content.write'), (req, res, next) => {
    validateDto(BulkClassesDto, req.body)
      .then((dto) => lessons.bulk(dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.get('/classes/:id', (req, res, next) => {
    lessons
      .getAdmin(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/classes/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(LessonPatchDto, req.body)
      .then((dto) => lessons.update(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/classes/:id', requirePermission('content.write'), (req, res, next) => {
    lessons
      .remove(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/classes/:id/publish', requirePermission('content.write'), (req, res, next) => {
    lessons
      .publish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/classes/:id/unpublish', requirePermission('content.write'), (req, res, next) => {
    lessons
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

function phaseParam(req: Request): number | undefined {
  const value = param(req);
  if (!/^[1-9]$/.test(value)) return undefined;
  return Number(value);
}
