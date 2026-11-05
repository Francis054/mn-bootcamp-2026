import { Router, type Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requirePermission } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { readMediaUpload } from '../gallery/upload.js';
import type { PortalProfileService } from './portal-profile.service.js';

export function mountPortalProfile(
  portal: Router,
  profiles: PortalProfileService,
  maxBytes: number,
): void {
  portal.get('/profile', (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    profiles
      .getOwn(user.id)
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.patch('/profile', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    profiles
      .updateOwn(user.id, req.body)
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.post('/profile/photo', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    readMediaUpload(req, maxBytes, imageSizeMessage(maxBytes))
      .then((upload) => profiles.setPhoto(user.id, upload.bytes, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch((error: unknown) => {
        next(asPhotoError(error));
      });
  });

  portal.delete('/profile/photo', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    profiles
      .clearPhoto(user.id, actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.post('/profile/submit', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    profiles
      .submit(user.id)
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.put('/consents', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    profiles
      .setConsents(user.id, req.body, actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
}

export function mountReviewQueue(admin: Router, profiles: PortalProfileService): void {
  admin.get('/review-queue', (_req, res, next) => {
    profiles
      .listQueue()
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });
  admin.patch('/review-queue/:traineeId', requirePermission('content.write'), (req, res, next) => {
    profiles
      .editPending(traineeParam(req), req.body, actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.post('/review-queue/:traineeId/approve', requirePermission('content.write'), (req, res, next) => {
    profiles
      .approve(traineeParam(req), actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.post('/review-queue/:traineeId/reject', requirePermission('content.write'), (req, res, next) => {
    profiles
      .reject(traineeParam(req), req.body, actorFrom(req))
      .then((row) => res.status(200).json(row))
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

function traineeParam(req: Request): string {
  const value = req.params.traineeId;
  return typeof value === 'string' ? value : '';
}
