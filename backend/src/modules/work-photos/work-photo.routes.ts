import { Router, type Request, type Response } from 'express';
import { requireRole } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { imageSizeMessage, projectIdMessage, traineeIdMessage } from './work-photo.rules.js';
import type { WorkPhotoService } from './work-photo.service.js';
import { readWorkPhotoUpload } from './upload.js';

export function mountPublicWorkPhotos(router: Router, photos: WorkPhotoService): void {
  router.get('/public/work-photos', (req, res, next) => {
    photos
      .listPublic(readPhotoFilter(req))
      .then((rows) => {
        // Do not let the browser reuse this list. An unpublished photo must leave the public page at once.
        res.setHeader('Cache-Control', 'private, no-store');
        res.json(rows);
      })
      .catch(next);
  });
  router.get('/public/work-photos/:id/file', (req, res, next) => {
    photos
      .open(param(req), 'public')
      .then((file) => {
        sendFile(res, file);
      })
      .catch(next);
  });
}

export function mountAdminWorkPhotos(
  admin: Router,
  photos: WorkPhotoService,
  maxBytes: number,
): void {
  const router = Router();
  router.use(requireRole('administrator'));
  router.get('/', (req, res, next) => {
    photos
      .listAdmin(readPhotoFilter(req))
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.post('/', (req, res, next) => {
    readWorkPhotoUpload(req, maxBytes, imageSizeMessage(maxBytes))
      .then((upload) => photos.createUpload(upload, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  router.get('/:id/file', (req, res, next) => {
    photos
      .open(param(req), 'admin')
      .then((file) => {
        sendFile(res, file);
      })
      .catch(next);
  });
  router.get('/:id', (req, res, next) => {
    photos
      .getAdmin(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  router.delete('/:id', (req, res, next) => {
    photos
      .remove(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  router.post('/:id/publish', (req, res, next) => {
    photos
      .publish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  router.post('/:id/unpublish', (req, res, next) => {
    photos
      .unpublish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.use('/work-photos', router);
}

function sendFile(
  res: Response,
  file: { kind: 'bytes'; mime: string; bytes: Buffer } | { kind: 'redirect'; url: string },
): void {
  if (file.kind === 'redirect') {
    res.redirect(302, file.url);
    return;
  }
  res.setHeader('Content-Type', file.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.bytes);
}

function readPhotoFilter(req: Request): { traineeId?: string; projectId?: string } {
  const traineeId = optionalQueryId(req.query.traineeId, 'traineeId', 'Choose a trainee.');
  const projectId = optionalQueryId(req.query.projectId, 'projectId', 'Choose a project.');
  const filter: { traineeId?: string; projectId?: string } = {};
  if (traineeId !== undefined) filter.traineeId = traineeId;
  if (projectId !== undefined) filter.projectId = projectId;
  return filter;
}

function optionalQueryId(value: unknown, field: string, invalid: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new ApiError('validation', 'Check the highlighted fields.', { [field]: invalid });
  }
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const problem = field === 'projectId' ? projectIdMessage(trimmed) : traineeIdMessage(trimmed);
  if (problem)
    throw new ApiError('validation', 'Check the highlighted fields.', { [field]: problem });
  return trimmed;
}

function actorFrom(req: Request): Actor {
  return {
    userId: req.user?.id ?? null,
    role: req.user?.role ?? null,
    ip: req.ip ?? null,
    requestId: req.id,
  };
}

function param(req: Request): string {
  const value = req.params.id;
  return typeof value === 'string' ? value : '';
}
