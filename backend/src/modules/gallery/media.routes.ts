import { Router, type Request } from 'express';
import { requirePermission } from '../auth/require-auth.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import type { Actor } from '../curriculum/actor.js';
import { imageSizeMessage } from './media.rules.js';
import { MediaCreateDto, MediaPatchDto } from './media.dto.js';
import type { MediaService } from './media.service.js';
import { readMediaUpload } from './upload.js';

export function mountPublicMedia(router: Router, media: MediaService): void {
  router.get('/public/media', (_req, res, next) => {
    media
      .listPublic()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/media/:id', (req, res, next) => {
    media
      .getPublic(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

export function mountAdminMedia(admin: Router, media: MediaService, maxBytes: number): void {
  admin.get('/media', (_req, res, next) => {
    media
      .listAdmin()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.post('/media', requirePermission('media.write'), (req, res, next) => {
    const type = req.header('content-type') ?? '';
    if (type.includes('multipart/form-data')) {
      readMediaUpload(req, maxBytes, imageSizeMessage(maxBytes))
        .then((upload) => media.createUpload(upload, actorFrom(req)))
        .then((row) => res.status(201).json(row))
        .catch(next);
      return;
    }
    validateDto(MediaCreateDto, req.body)
      .then((dto) => media.createMetadata(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/media/:id', (req, res, next) => {
    media
      .getAdmin(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/media/:id', requirePermission('media.write'), (req, res, next) => {
    validateDto(MediaPatchDto, req.body)
      .then((dto) => media.update(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/media/:id', requirePermission('media.write'), (req, res, next) => {
    media
      .remove(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/media/:id/publish', requirePermission('media.write'), (req, res, next) => {
    media
      .publish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/media/:id/unpublish', requirePermission('media.write'), (req, res, next) => {
    media
      .unpublish(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/media/:id/withdraw-consent', requirePermission('media.write'), (req, res, next) => {
    media
      .withdraw(param(req), actorFrom(req))
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
