import { Router, type Request, type Response } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requirePermission, requireRole } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { HIDDEN_CV } from './cv-rules.js';
import type { CvFile, CvService } from './cv.service.js';
import { readCvUpload } from './cv-upload.js';

export function mountPortalCv(portal: Router, cvs: CvService): void {
  portal.get('/cv', (req, res, next) => {
    own(req, next, (userId) =>
      cvs.getOwn(userId).then((row) => {
        sendJson(res, 200, row);
      }),
    );
  });
  portal.post('/cv', cvs.uploadLimit, requirePermission('portal.write'), (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    readCvUpload(req)
      .then((upload) =>
        cvs.uploadOwn(user.id, upload.bytes, upload.fileName, upload.visibility, actorFrom(req)),
      )
      .then((row) => {
        sendJson(res, 201, row);
      })
      .catch(next);
  });
  portal.patch('/cv', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) =>
      cvs.setVisibilityOwn(userId, req.body, actorFrom(req)).then((row) => {
        sendJson(res, 200, row);
      }),
    );
  });
  portal.delete('/cv', requirePermission('portal.write'), (req, res, next) => {
    own(req, next, (userId) =>
      cvs.removeOwn(userId, actorFrom(req)).then((row) => {
        sendJson(res, 200, row);
      }),
    );
  });
  portal.get('/cv/file', cvs.downloadLimit, (req, res, next) => {
    own(req, next, (userId) =>
      cvs.readOwn(userId).then((file) => {
        sendPdf(res, file);
      }),
    );
  });
}

export function mountPublicCv(router: Router, cvs: CvService): void {
  router.post('/public/trainees/:id/cv-link', cvs.downloadLimit, (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    cvs
      .mintPublicLink(param(req, 'id'))
      .then((link) => {
        res.status(200).json(link);
      })
      .catch(next);
  });
  router.get('/public/cv/:token', cvs.downloadLimit, (req, res, next) => {
    cvs
      .readPublicToken(param(req, 'token'))
      .then((file) => {
        sendPdf(res, file);
      })
      .catch(next);
  });
}

/** Adds `cv` to the public trainee payload. The value is never a file address. */
export async function withPublicCv<T extends { id: string }>(
  cvs: CvService,
  rows: readonly T[],
): Promise<Array<T & { cv: { available: boolean; mode: 'public' | 'on_request' | null } }>> {
  const flags = await cvs.publicFlags(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, cv: flags.get(row.id) ?? HIDDEN_CV }));
}

export function mountCvReview(admin: Router, cvs: CvService): void {
  admin.get('/review-queue/cvs', (_req, res, next) => {
    cvs
      .listQueue()
      .then((rows) => {
        sendJson(res, 200, rows);
      })
      .catch(next);
  });
  admin.post(
    '/review-queue/cvs/:id/approve',
    requirePermission('content.write'),
    (req, res, next) => {
      cvs
        .approve(param(req, 'id'), actorFrom(req))
        .then((row) => {
          sendJson(res, 200, row);
        })
        .catch(next);
    },
  );
  admin.post(
    '/review-queue/cvs/:id/reject',
    requirePermission('content.write'),
    (req, res, next) => {
      cvs
        .reject(param(req, 'id'), req.body, actorFrom(req))
        .then((row) => {
          sendJson(res, 200, row);
        })
        .catch(next);
    },
  );
}

/**
 * Editors can see a CV and approve it. Downloading, replacing, and removing stay
 * with administrators. Whether editors should approve is still an open question.
 */
export function mountAdminCv(admin: Router, cvs: CvService): void {
  admin.get('/trainees/:traineeId/cv', (req, res, next) => {
    cvs
      .getForTrainee(param(req, 'traineeId'))
      .then((row) => {
        sendJson(res, 200, row);
      })
      .catch(next);
  });
  admin.get(
    '/trainees/:traineeId/cv/file',
    cvs.downloadLimit,
    requireRole('administrator'),
    (req, res, next) => {
      cvs
        .readForTrainee(param(req, 'traineeId'))
        .then((file) => {
          sendPdf(res, file);
        })
        .catch(next);
    },
  );
  admin.post(
    '/trainees/:traineeId/cv',
    cvs.uploadLimit,
    requireRole('administrator'),
    (req, res, next) => {
      readCvUpload(req)
        .then((upload) =>
          cvs.uploadForTrainee(
            param(req, 'traineeId'),
            upload.bytes,
            upload.fileName,
            upload.visibility,
            actorFrom(req),
          ),
        )
        .then((row) => {
          sendJson(res, 201, row);
        })
        .catch(next);
    },
  );
  admin.delete('/trainees/:traineeId/cv', requireRole('administrator'), (req, res, next) => {
    cvs
      .removeForTrainee(param(req, 'traineeId'), actorFrom(req))
      .then((row) => {
        sendJson(res, 200, row);
      })
      .catch(next);
  });
}

function sendPdf(res: Response, file: CvFile): void {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', file.disposition);
  res.setHeader('Content-Length', String(file.bytes.length));
  res.status(200).end(file.bytes);
}

function sendJson(res: Response, status: number, body: unknown): void {
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(status).json(body);
}

function own(
  req: Request,
  next: (error: unknown) => void,
  run: (userId: string) => Promise<unknown>,
): void {
  const user = req.user;
  if (!user) {
    next(new ApiError('unauthenticated', 'Sign in to continue.'));
    return;
  }
  run(user.id).catch(next);
}

function actorFrom(req: Request): Actor {
  return { userId: req.user?.id ?? null, ip: req.ip ?? null, requestId: req.id };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}
