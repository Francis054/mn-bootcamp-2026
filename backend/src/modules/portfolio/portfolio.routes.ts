import { Router, type Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requirePermission } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { readMediaUpload } from '../gallery/upload.js';
import type { PortfolioService } from './portfolio.service.js';
import { videoSizeMessage } from './video-bytes.js';
import { readVideoFile } from './video-upload.js';

export function mountPortalPortfolio(
  portal: Router,
  portfolio: PortfolioService,
  maxImageBytes: number,
  maxVideoBytes: number,
): void {
  portal.get('/portfolio', (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .listOwn(user.id)
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });

  portal.post('/portfolio', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .createOwn(user.id, req.body)
      .then((row) => res.status(201).json(row))
      .catch(next);
  });

  portal.post('/portfolio/reorder', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .reorderOwn(user.id, req.body)
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });

  portal.get('/portfolio/:id', (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .getOwn(user.id, param(req, 'id'))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.patch('/portfolio/:id', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .updateOwn(user.id, param(req, 'id'), req.body)
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.delete('/portfolio/:id', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .deleteOwn(user.id, param(req, 'id'), actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.post('/portfolio/:id/submit', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .submit(user.id, param(req, 'id'))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.post('/portfolio/:id/images', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    readMediaUpload(req, maxImageBytes, imageSizeMessage(maxImageBytes))
      .then((upload) => portfolio.addImage(user.id, param(req, 'id'), upload.bytes, upload.alt))
      .then((row) => res.status(201).json(row))
      .catch((error: unknown) => {
        next(asImageError(error));
      });
  });

  portal.delete('/portfolio/:id/images/:mediaId', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .removeImage(user.id, param(req, 'id'), param(req, 'mediaId'))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.post('/portfolio/:id/videos', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .addVideoLink(user.id, param(req, 'id'), req.body)
      .then((row) => res.status(201).json(row))
      .catch(next);
  });

  portal.post('/portfolio/:id/videos/grant', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .createVideoGrant(user.id, param(req, 'id'), req.body)
      .then((row) => res.status(201).json(row))
      .catch(next);
  });

  portal.post('/portfolio/:id/videos/file', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    readVideoFile(req, maxVideoBytes, videoSizeMessage(maxVideoBytes))
      .then((upload) => portfolio.addVideoFile(user.id, param(req, 'id'), upload.grantId, upload.bytes))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });

  portal.post('/portfolio/:id/videos/complete', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .completeVideo(user.id, param(req, 'id'), req.body)
      .then((row) => res.status(201).json(row))
      .catch(next);
  });

  portal.delete('/portfolio/:id/videos/:mediaId', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .removeVideo(user.id, param(req, 'id'), param(req, 'mediaId'))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });

  portal.post('/portfolio/:id/media/reorder', requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    portfolio
      .reorderMedia(user.id, param(req, 'id'), req.body)
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
}

export function mountPublicPortfolio(router: Router, portfolio: PortfolioService): void {
  router.get('/public/trainees/:id/portfolio', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    portfolio
      .listPublic(param(req, 'id'))
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });
}

export function mountPortfolioReview(admin: Router, portfolio: PortfolioService): void {
  admin.get('/review-queue/items', (_req, res, next) => {
    portfolio
      .listQueue()
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });
  admin.patch('/review-queue/items/:id', requirePermission('content.write'), (req, res, next) => {
    portfolio
      .editPending(param(req, 'id'), req.body, actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.post('/review-queue/items/:id/approve', requirePermission('content.write'), (req, res, next) => {
    portfolio
      .approve(param(req, 'id'), actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.post('/review-queue/items/:id/reject', requirePermission('content.write'), (req, res, next) => {
    portfolio
      .reject(param(req, 'id'), req.body, actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
  admin.delete('/review-queue/items/:id', requirePermission('content.write'), (req, res, next) => {
    portfolio
      .deleteByAdmin(param(req, 'id'), actorFrom(req))
      .then((row) => res.status(200).json(row))
      .catch(next);
  });
}

function asImageError(error: unknown): unknown {
  if (!(error instanceof ApiError) || !error.fieldErrors?.file) return error;
  const { file, ...rest } = error.fieldErrors;
  return new ApiError(error.code, error.message, { ...rest, image: file });
}

function actorFrom(req: Request): Actor {
  return {
    userId: req.user?.id ?? null,
    ip: req.ip ?? null,
    requestId: req.id,
  };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}
