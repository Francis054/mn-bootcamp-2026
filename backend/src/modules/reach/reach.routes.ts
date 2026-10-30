import { Router, type Request, type Response } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requirePermission } from '../auth/require-auth.js';
import type { ReachService } from './reach.service.js';

export function mountPublicReach(router: Router, reach: ReachService): void {
  router.get('/public/trainees/:id/profile.pdf', reach.publicLimit, (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    reach
      .profilePdf(param(req, 'id'))
      .then((bytes) => {
        sendPdf(res, bytes);
      })
      .catch(next);
  });
  router.post('/public/trainees/:id/contact', reach.publicLimit, (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    reach
      .contact({
        slugOrId: param(req, 'id'),
        body: req.body,
        ip: req.ip ?? '',
        requestId: req.id,
      })
      .then((row) => {
        res.status(200).json(row);
      })
      .catch(next);
  });
  router.post('/public/trainees/:id/cv-request', reach.publicLimit, (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    reach
      .requestCv({
        slugOrId: param(req, 'id'),
        body: req.body,
        ip: req.ip ?? '',
        requestId: req.id,
      })
      .then((row) => {
        res.status(200).json(row);
      })
      .catch(next);
  });
}

export function mountAdminReach(admin: Router, reach: ReachService): void {
  admin.get('/contact-requests', (_req, res, next) => {
    reach
      .listContacts()
      .then((rows) => {
        res.status(200).json(rows);
      })
      .catch(next);
  });
  admin.post(
    '/contact-requests/:id/block',
    requirePermission('content.write'),
    (req, res, next) => {
      const actor = req.user?.id;
      if (!actor) {
        next(new ApiError('unauthenticated', 'Sign in to continue.'));
        return;
      }
      reach
        .blockContact(param(req, 'id'), actor, req.ip ?? '', req.id)
        .then((row) => {
          res.status(200).json(row);
        })
        .catch(next);
    },
  );
  admin.get('/cv-requests', (_req, res, next) => {
    reach
      .listCvRequests()
      .then((rows) => {
        res.status(200).json(rows);
      })
      .catch(next);
  });
  admin.post('/cv-requests/:id/send', requirePermission('content.write'), (req, res, next) => {
    const actor = req.user?.id;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    reach
      .sendCvRequest(param(req, 'id'), actor, req.ip ?? '', req.id)
      .then((row) => {
        res.status(200).json(row);
      })
      .catch(next);
  });
}

function sendPdf(res: Response, bytes: Uint8Array): void {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="trainee-profile.pdf"');
  res.setHeader('Content-Length', String(bytes.length));
  res.status(200).end(Buffer.from(bytes));
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}
