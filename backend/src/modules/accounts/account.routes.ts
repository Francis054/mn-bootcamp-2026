import { Router, type Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requirePermission } from '../auth/require-auth.js';
import type { EnquiryService } from '../enquiries/enquiry.service.js';
import { readText } from './account.rules.js';
import type { AccountService } from './account.service.js';

export function mountPublicEnquiries(router: Router, enquiries: EnquiryService): void {
  router.post('/public/enquiries', (req, res, next) => {
    enquiries
      .create({
        body: req.body,
        ip: req.ip ?? 'unknown',
        requestId: req.id,
        now: new Date(),
      })
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });
}

export function mountAccountAdmin(
  admin: Router,
  accounts: AccountService,
  enquiries: EnquiryService,
): void {
  admin.post('/account/password', requirePermission('account.manage'), (req, res, next) => {
    const user = req.user;
    const sessionId = req.sessionId;
    if (!user || !sessionId) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    accounts
      .changePassword({
        userId: user.id,
        sessionId,
        current: readText(req.body, 'current'),
        next: readText(req.body, 'next'),
        confirm: readText(req.body, 'confirm'),
        ip: req.ip ?? 'unknown',
        requestId: req.id,
      })
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });

  admin.get('/users', requirePermission('users.read'), (_req, res, next) => {
    accounts
      .listUsers()
      .then((rows) => {
        res.status(200).json(rows);
      })
      .catch(next);
  });

  admin.patch('/users/:id', requirePermission('users.manage'), (req, res, next) => {
    const actor = req.user;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    accounts
      .updateRole({
        actorId: actor.id,
        userId: param(req),
        role: readText(req.body, 'role'),
        ip: req.ip ?? 'unknown',
        requestId: req.id,
      })
      .then((row) => {
        res.status(200).json(row);
      })
      .catch(next);
  });

  admin.post('/users/invite', requirePermission('users.manage'), (req, res, next) => {
    const actor = req.user;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    accounts
      .invite({
        email: readText(req.body, 'email'),
        role: readText(req.body, 'role'),
        actorId: actor.id,
        ip: req.ip ?? 'unknown',
        requestId: req.id,
        now: new Date(),
      })
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });

  admin.get('/enquiries', requirePermission('users.manage'), (_req, res, next) => {
    enquiries
      .list()
      .then((rows) => {
        res.status(200).json(rows);
      })
      .catch(next);
  });

  admin.patch('/enquiries/:id', requirePermission('users.manage'), (req, res, next) => {
    const actor = req.user;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    enquiries
      .setHandled({
        id: param(req),
        body: req.body,
        actorId: actor.id,
        ip: req.ip ?? 'unknown',
        requestId: req.id,
      })
      .then((row) => {
        res.status(200).json(row);
      })
      .catch(next);
  });

  admin.delete('/enquiries/:id', requirePermission('users.manage'), (req, res, next) => {
    const actor = req.user;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    enquiries
      .remove({
        id: param(req),
        actorId: actor.id,
        ip: req.ip ?? 'unknown',
        requestId: req.id,
      })
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });
}

function param(req: Request): string {
  const value = req.params.id;
  return typeof value === 'string' ? value : '';
}
