import { Router, type Request } from 'express';
import { ApiError } from '../../shared/errors/api-error.js';
import { requirePermission } from '../auth/require-auth.js';
import type { JourneyService, MilestoneActor } from './journey.service.js';

export function mountPublicJourney(router: Router, journey: JourneyService): void {
  router.get('/public/trainees/:slug/journey', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    journey
      .publicJourney(param(req, 'slug'))
      .then((body) => {
        res.status(200).json(body);
      })
      .catch(next);
  });
}

export function mountPortalJourney(portal: Router, journey: JourneyService): void {
  portal.get('/journey', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const actor = signedIn(req);
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    journey
      .ownJourney(actor.loginId)
      .then((body) => {
        res.status(200).json(body);
      })
      .catch(next);
  });

  portal.post('/journey/milestones', requirePermission('portal.write'), (req, res, next) => {
    const actor = signedIn(req);
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    journey
      .createMilestone(actor, req.body)
      .then((row) => {
        res.status(201).json(row);
      })
      .catch(next);
  });

  portal.patch('/journey/milestones/:id', requirePermission('portal.write'), (req, res, next) => {
    const actor = signedIn(req);
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    journey
      .updateMilestone(actor, param(req, 'id'), req.body)
      .then((row) => {
        res.status(200).json(row);
      })
      .catch(next);
  });

  portal.delete('/journey/milestones/:id', requirePermission('portal.write'), (req, res, next) => {
    const actor = signedIn(req);
    if (!actor) {
      next(new ApiError('unauthenticated', 'Sign in to continue.'));
      return;
    }
    journey
      .deleteMilestone(actor, param(req, 'id'))
      .then((row) => {
        res.status(200).json(row);
      })
      .catch(next);
  });
}

function signedIn(req: Request): MilestoneActor | null {
  const login = req.user;
  if (!login) return null;
  return { loginId: login.id, ip: req.ip ?? null, requestId: req.id };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}
