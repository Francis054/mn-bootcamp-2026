import { Router, type Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { PUBLIC_GET_CACHE_CONTROL } from '../../shared/http/cache-control.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import { requirePermission } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { readMediaUpload } from '../gallery/upload.js';
import type { StorageProvider } from '../storage/storage-provider.js';
import { readMemoryUpload } from './profile-photo.js';
import { TraineeCreateDto, TraineePatchDto } from './trainee.dto.js';
import { readDirectoryQuery } from '../reach/directory.js';
import { readTraineeListQuery } from './list-query.js';
import type { TraineeService } from './trainee.service.js';
import { withPublicCv } from '../documents/cv.routes.js';
import type { CvService } from '../documents/cv.service.js';

export function mountPublicTraineePhotos(router: Router, storage: StorageProvider): void {
  router.get('/public/uploads/:key', (req, res, next) => {
    const key = typeof req.params.key === 'string' ? req.params.key : '';
    const image = readMemoryUpload(storage, key);
    if (!image) {
      next(new ApiError('not_found', 'That photo is not available.'));
      return;
    }
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Cache-Control', PUBLIC_GET_CACHE_CONTROL);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(image.bytes);
  });
}

export function mountPublicTrainees(
  router: Router,
  trainees: TraineeService,
  cvs: CvService,
): void {
  router.get('/public/trainees', (req, res, next) => {
    trainees
      .listPublic(readDirectoryQuery(req.query))
      .then((rows) => withPublicCv(cvs, rows))
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/trainees/:id', (req, res, next) => {
    trainees
      .getPublic(param(req))
      .then((row) => withPublicCv(cvs, [row]))
      .then((rows) => {
        const one = rows[0];
        if (!one) {
          next(new ApiError('not_found', 'That page is not available.'));
          return;
        }
        res.json(one);
      })
      .catch(next);
  });
}

export function mountAdminTrainees(
  admin: Router,
  trainees: TraineeService,
  maxBytes: number,
): void {
  admin.post('/trainees/photo', requirePermission('content.write'), (req, res, next) => {
    readMediaUpload(req, maxBytes, imageSizeMessage(maxBytes))
      .then((upload) => trainees.storePhoto(upload.bytes))
      .then((row) => res.status(201).json(row))
      .catch((error: unknown) => {
        next(asPhotoError(error));
      });
  });
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

function asPhotoError(error: unknown): unknown {
  if (!(error instanceof ApiError) || !error.fieldErrors?.file) return error;
  const { file, ...rest } = error.fieldErrors;
  return new ApiError(error.code, error.message, { ...rest, photoUrl: file });
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
