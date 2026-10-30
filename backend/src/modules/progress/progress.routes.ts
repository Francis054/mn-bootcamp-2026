import { Router, type Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requireAuth, requirePermission } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { Actor } from '../curriculum/actor.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { readMediaUpload } from '../gallery/upload.js';
import type { ProgressService } from './progress.service.js';

export function mountPortalProgress(portal: Router, progress: ProgressService, maxImageBytes: number): void {
  portal.get('/skills', (req, res, next) => {
    own(req, next, (userId) => progress.listOwnSkills(userId).then((rows) => res.status(200).json(rows)));
  });
  portal.post('/skills', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.createOwnSkill(userId, req.body).then((row) => res.status(201).json(row)));
  });
  portal.patch('/skills/:id', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.updateOwnSkill(userId, param(req, 'id'), req.body).then((row) => res.status(200).json(row)));
  });
  portal.delete('/skills/:id', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.deleteOwnSkill(userId, param(req, 'id')).then((row) => res.status(200).json(row)));
  });
  portal.post('/skills/:id/submit', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.submitSkill(userId, param(req, 'id')).then((row) => res.status(200).json(row)));
  });

  portal.get('/events', (req, res, next) => {
    own(req, next, (userId) => progress.listOwnEvents(userId).then((rows) => res.status(200).json(rows)));
  });
  portal.post('/events', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.createOwnEvent(userId, req.body).then((row) => res.status(201).json(row)));
  });
  portal.patch('/events/:id', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.updateOwnEvent(userId, param(req, 'id'), req.body).then((row) => res.status(200).json(row)));
  });
  portal.delete('/events/:id', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.deleteOwnEvent(userId, param(req, 'id')).then((row) => res.status(200).json(row)));
  });
  portal.post('/events/:id/submit', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.submitEvent(userId, param(req, 'id')).then((row) => res.status(200).json(row)));
  });
  portal.post('/events/:id/certificate', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    readMediaUpload(req, maxImageBytes, imageSizeMessage(maxImageBytes))
      .then((upload) => progress.addOwnCertificate(user.id, param(req, 'id'), upload.bytes))
      .then((row) => res.status(201).json(row))
      .catch((error: unknown) => {
        next(asCertificateError(error));
      });
  });
  portal.delete('/events/:id/certificate', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) => progress.removeOwnCertificate(userId, param(req, 'id')).then((row) => res.status(200).json(row)));
  });
}

export function mountPublicProgress(router: Router, progress: ProgressService): void {
  router.get('/public/trainees/:id/skills', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    progress
      .listPublicSkills(param(req, 'id'))
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });
  router.get('/public/trainees/:id/events', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    progress
      .listPublicEvents(param(req, 'id'))
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });
}

export function mountProgressReview(admin: Router, progress: ProgressService): void {
  admin.get('/review-queue/skills', (_req, res, next) => {
    progress.listSkillQueue().then((rows) => res.status(200).json(rows)).catch(next);
  });
  admin.patch('/review-queue/skills/:id', requirePermission('content.write'), (req, res, next) => {
    progress.editPendingSkill(param(req, 'id'), req.body, actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });
  admin.post('/review-queue/skills/:id/approve', requirePermission('content.write'), (req, res, next) => {
    progress.approveSkill(param(req, 'id'), actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });
  admin.post('/review-queue/skills/:id/reject', requirePermission('content.write'), (req, res, next) => {
    progress.rejectSkill(param(req, 'id'), req.body, actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });
  admin.delete('/review-queue/skills/:id', requirePermission('content.write'), (req, res, next) => {
    progress.deleteSkillByAdmin(param(req, 'id'), actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });

  admin.get('/review-queue/events', (_req, res, next) => {
    progress.listEventQueue().then((rows) => res.status(200).json(rows)).catch(next);
  });
  admin.patch('/review-queue/events/:id', requirePermission('content.write'), (req, res, next) => {
    progress.editPendingEvent(param(req, 'id'), req.body, actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });
  admin.post('/review-queue/events/:id/approve', requirePermission('content.write'), (req, res, next) => {
    progress.approveEvent(param(req, 'id'), actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });
  admin.post('/review-queue/events/:id/reject', requirePermission('content.write'), (req, res, next) => {
    progress.rejectEvent(param(req, 'id'), req.body, actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });
  admin.delete('/review-queue/events/:id', requirePermission('content.write'), (req, res, next) => {
    progress.deleteEventByAdmin(param(req, 'id'), actorFrom(req)).then((row) => res.status(200).json(row)).catch(next);
  });
}

export function mountAdminProgress(admin: Router, progress: ProgressService, maxImageBytes: number): void {
  admin.get('/trainees/:traineeId/skills', (req, res, next) => {
    progress.listSkillsForTrainee(param(req, 'traineeId')).then((rows) => res.status(200).json(rows)).catch(next);
  });
  admin.post('/trainees/:traineeId/skills', requirePermission('content.write'), (req, res, next) => {
    progress
      .createSkillForTrainee(param(req, 'traineeId'), req.body, actorFrom(req))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.patch('/trainees/:traineeId/skills/:id', requirePermission('content.write'), (req, res, next) => {
    progress
      .editSkillForTrainee(param(req, 'traineeId'), param(req, 'id'), req.body, actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.delete('/trainees/:traineeId/skills/:id', requirePermission('content.write'), (req, res, next) => {
    progress
      .deleteSkillForTrainee(param(req, 'traineeId'), param(req, 'id'), actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  admin.get('/trainees/:traineeId/events', (req, res, next) => {
    progress.listEventsForTrainee(param(req, 'traineeId')).then((rows) => res.status(200).json(rows)).catch(next);
  });
  admin.post('/trainees/:traineeId/events', requirePermission('content.write'), (req, res, next) => {
    progress
      .createEventForTrainee(param(req, 'traineeId'), req.body, actorFrom(req))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.patch('/trainees/:traineeId/events/:id', requirePermission('content.write'), (req, res, next) => {
    progress
      .editEventForTrainee(param(req, 'traineeId'), param(req, 'id'), req.body, actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.delete('/trainees/:traineeId/events/:id', requirePermission('content.write'), (req, res, next) => {
    progress
      .deleteEventForTrainee(param(req, 'traineeId'), param(req, 'id'), actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.post('/trainees/:traineeId/events/:id/certificate', requirePermission('content.write'), (req, res, next) => {
    readMediaUpload(req, maxImageBytes, imageSizeMessage(maxImageBytes))
      .then((upload) => progress.addCertificateForTrainee(param(req, 'traineeId'), param(req, 'id'), upload.bytes, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch((error: unknown) => {
        next(asCertificateError(error));
      });
  });
}

export function mountTrainerProgress(router: Router, sessions: SessionService, progress: ProgressService): void {
  const staff = Router();
  staff.use(requireAuth(sessions), requirePermission('progress.read'));
  staff.get('/trainees', (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    progress
      .listForTrainer(user.id)
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });
  router.use('/progress', staff);
}

function own(req: Request, next: (error: unknown) => void, run: (userId: string) => Promise<unknown>): void {
  const user = req.user;
  if (!user) {
    next(new ApiError('unauthenticated', 'Sign in to continue.'));
    return;
  }
  run(user.id).catch(next);
}

function asCertificateError(error: unknown): unknown {
  if (!(error instanceof ApiError) || !error.fieldErrors?.file) return error;
  const { file, ...rest } = error.fieldErrors;
  return new ApiError(error.code, error.message, { ...rest, certificate: file });
}

function actorFrom(req: Request): Actor {
  return { userId: req.user?.id ?? null, ip: req.ip ?? null, requestId: req.id };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}
