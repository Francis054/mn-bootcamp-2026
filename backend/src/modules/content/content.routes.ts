import { Router, type Request } from 'express';
import { requirePermission } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import type { ContentService } from './content.service.js';

export function mountPublicContent(router: Router, content: ContentService): void {
  router.get('/public/home', (_req, res, next) => {
    content
      .getPublicHome()
      .then((row) => res.json(row))
      .catch(next);
  });
  router.get('/public/about', (_req, res, next) => {
    content
      .getPublicAbout()
      .then((row) => res.json(row))
      .catch(next);
  });
  router.get('/public/milestones', (_req, res, next) => {
    content
      .listPublicMilestones()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/foundation-stats', (_req, res, next) => {
    content
      .listPublicFoundationStats()
      .then((rows) => res.json(rows))
      .catch(next);
  });
}

export function mountAdminContent(admin: Router, content: ContentService): void {
  admin.get('/home', (_req, res, next) => {
    content
      .getAdminHome()
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.put('/home', requirePermission('content.write'), (req, res, next) => {
    content
      .updateHome(req.body, actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/home/publish', requirePermission('content.write'), (req, res, next) => {
    content
      .publishHome(actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/home/unpublish', requirePermission('content.write'), (req, res, next) => {
    content
      .unpublishHome(actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });

  admin.get('/about', (_req, res, next) => {
    content
      .getAdminAbout()
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.put('/about', requirePermission('content.write'), (req, res, next) => {
    content
      .updateAbout(req.body, actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/about/publish', requirePermission('content.write'), (req, res, next) => {
    content
      .publishAbout(actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/about/unpublish', requirePermission('content.write'), (req, res, next) => {
    content
      .unpublishAbout(actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });

  admin.get('/milestones', (_req, res, next) => {
    content
      .listAdminMilestones()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.put('/milestones', requirePermission('content.write'), (req, res, next) => {
    content
      .updateMilestones(req.body, actorFrom(req))
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.post('/milestones/publish', requirePermission('content.write'), (req, res, next) => {
    content
      .publishMilestones(actorFrom(req))
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.post('/milestones/unpublish', requirePermission('content.write'), (req, res, next) => {
    content
      .unpublishMilestones(actorFrom(req))
      .then((rows) => res.json(rows))
      .catch(next);
  });

  const settings = requirePermission('settings.manage');
  admin.get('/settings', settings, (_req, res, next) => {
    content
      .getAdminSettings()
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.put('/settings', settings, (req, res, next) => {
    content
      .updateSettings(req.body, actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/settings/publish', settings, (req, res, next) => {
    content
      .publishSettings(actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/settings/unpublish', settings, (req, res, next) => {
    content
      .unpublishSettings(actorFrom(req))
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
