import { Router, type Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requireAuth, requirePermission } from '../auth/require-auth.js';
import type { SessionService } from '../auth/session.service.js';
import type { SignupService } from './signup.service.js';

export function mountPublicSignup(router: Router, signup: SignupService): void {
  router.post('/public/trainee-signup', (req, res, next) => {
    signup
      .signup({ body: req.body, ip: req.ip ?? 'unknown', requestId: req.id, now: new Date() })
      .then((result) => {
        res.status(202).json(result);
      })
      .catch(next);
  });

  router.post('/public/trainee-signup/verify', (req, res, next) => {
    const token = isRecord(req.body) && typeof req.body.token === 'string' ? req.body.token : '';
    signup
      .verify({ token, ip: req.ip ?? 'unknown', requestId: req.id, now: new Date() })
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });

  router.post('/public/trainee-signup/resend', (req, res, next) => {
    signup
      .resend({ body: req.body, ip: req.ip ?? 'unknown', requestId: req.id, now: new Date() })
      .then((result) => {
        res.status(202).json(result);
      })
      .catch(next);
  });
}

export function mountPortal(router: Router, signup: SignupService, sessions: SessionService): void {
  const portal = Router();
  portal.use(requireAuth(sessions), requirePermission('portal.access'));
  portal.get('/me', (req, res, next) => {
    const user = req.user;
    if (!user) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    signup
      .portalMe(user.id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });
  router.use('/portal', portal);
}

export function mountTraineeAdmin(admin: Router, signup: SignupService): void {
  admin.get('/pending-registrations', requirePermission('users.manage'), (_req, res, next) => {
    signup
      .listPending()
      .then((rows) => {
        res.status(200).json(rows);
      })
      .catch(next);
  });

  admin.post('/pending-registrations/:id/approve', requirePermission('users.manage'), (req, res, next) => {
    const actor = req.user;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    signup
      .approve({
        id: param(req),
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

  admin.post('/pending-registrations/:id/reject', requirePermission('users.manage'), (req, res, next) => {
    const actor = req.user;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    signup
      .reject({
        id: param(req),
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

  admin.get('/trainee-accounts', requirePermission('users.manage'), (_req, res, next) => {
    signup
      .listTraineeAccounts()
      .then((rows) => {
        res.status(200).json(rows);
      })
      .catch(next);
  });

  admin.post('/trainee-accounts/:id/disable', requirePermission('users.manage'), (req, res, next) => {
    setDisabled(signup, req, true)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });

  admin.post('/trainee-accounts/:id/enable', requirePermission('users.manage'), (req, res, next) => {
    setDisabled(signup, req, false)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  });

  admin.post('/trainee-accounts/:id/resend-invite', requirePermission('users.manage'), (req, res, next) => {
    const actor = req.user;
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    signup
      .resendInvite({
        userId: param(req),
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
}

function setDisabled(signup: SignupService, req: Request, disabled: boolean): Promise<unknown> {
  const actor = req.user;
  if (!actor) return Promise.reject(new ApiError('unauthenticated', 'Sign in to continue.'));
  return signup.setDisabled({
    userId: param(req),
    disabled,
    actorId: actor.id,
    ip: req.ip ?? 'unknown',
    requestId: req.id,
    now: new Date(),
  });
}

function param(req: Request): string {
  const value = req.params.id;
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
