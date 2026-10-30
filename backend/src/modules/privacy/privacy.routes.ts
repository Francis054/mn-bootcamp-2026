import { Router, type Request, type Response } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import type { Actor } from '../curriculum/actor.js';
import { requireRole } from '../auth/require-auth.js';
import type { OutboxMail } from '../mail/outbox-mail.js';
import type { TraineePrivacyService } from './trainee-privacy.service.js';

const MISSING_MAIL = 'That message was not found.';

export function mountPrivacyAdmin(
  admin: Router,
  outbox: OutboxMail | undefined,
  privacy: TraineePrivacyService | undefined,
): void {
  admin.get('/email-outbox/failed', requireRole('administrator'), (_req, res, next) => {
    if (!outbox) {
      next(new ApiError('server', 'Mail is not available.'));
      return;
    }
    outbox
      .listAttention()
      .then((rows) => {
        res.json(rows);
      })
      .catch(next);
  });
  admin.post('/email-outbox/:id/resend', requireRole('administrator'), (req, res, next) => {
    if (!outbox) {
      next(new ApiError('server', 'Mail is not available.'));
      return;
    }
    const id = param(req, 'id');
    outbox
      .resend(id)
      .then(async (result) => {
        if (!result) throw new ApiError('not_found', MISSING_MAIL);
        if (privacy) await privacy.recordResend(actorFrom(req), id);
        res.json({ id, delivered: result.delivered });
      })
      .catch(next);
  });
  admin.get('/trainee-removals', requireRole('administrator'), (_req, res, next) => {
    requirePrivacy(privacy)
      .listOpen()
      .then((rows) => {
        res.json(rows);
      })
      .catch(next);
  });
  admin.post('/trainee-removals/:id/retry', requireRole('administrator'), (req, res, next) => {
    requirePrivacy(privacy)
      .retry(param(req, 'id'), actorFrom(req))
      .then((row) => {
        res.json(row);
      })
      .catch(next);
  });
  admin.get('/trainees/:id/export', requireRole('administrator'), (req, res, next) => {
    requirePrivacy(privacy)
      .exportZip(param(req, 'id'), actorFrom(req))
      .then((file) => {
        sendZip(res, file);
      })
      .catch(next);
  });
  admin.post('/trainees/:id/erase', requireRole('administrator'), (req, res, next) => {
    requirePrivacy(privacy)
      .erase(param(req, 'id'), req.body, actorFrom(req))
      .then((row) => {
        res.json(row);
      })
      .catch(next);
  });
}

function requirePrivacy(privacy: TraineePrivacyService | undefined): TraineePrivacyService {
  if (!privacy) throw new ApiError('server', 'Trainee data tools are not available.');
  return privacy;
}

function sendZip(res: Response, file: { filename: string; bytes: Buffer }): void {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(file.bytes);
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
