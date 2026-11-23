import { Router, type Request } from 'express';
import { requirePermission } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { readMediaUpload } from '../gallery/upload.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import {
  AboutPersonCreateDto,
  AboutPersonPatchDto,
  AboutPersonReorderDto,
} from './about-person.dto.js';
import type { AboutPersonService } from './about-person.service.js';

export function mountPublicAboutPeople(router: Router, people: AboutPersonService): void {
  router.get('/public/about-people', (_req, res, next) => {
    people
      .listPublic()
      .then((rows) => {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json(rows);
      })
      .catch(next);
  });
}

export function mountAdminAboutPeople(
  admin: Router,
  people: AboutPersonService,
  maxBytes: number,
): void {
  const write = requirePermission('content.write');
  admin.get('/about-people', (_req, res, next) => {
    people
      .listAdmin()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.post('/about-people', write, (req, res, next) => {
    validateDto(AboutPersonCreateDto, req.body)
      .then((dto) => people.create(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.post('/about-people/reorder', write, (req, res, next) => {
    validateDto(AboutPersonReorderDto, req.body)
      .then((dto) => people.reorder(dto.group, dto.ids, actorFrom(req)))
      .then((rows) => res.json(rows))
      .catch(next);
  });
  admin.get('/about-people/:id', (req, res, next) => {
    people
      .getAdmin(param(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.patch('/about-people/:id', write, (req, res, next) => {
    validateDto(AboutPersonPatchDto, req.body)
      .then((dto) => people.update(param(req), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.post('/about-people/:id/photo', write, (req, res, next) => {
    readMediaUpload(req, maxBytes, imageSizeMessage(maxBytes))
      .then((upload) => people.replacePhoto(param(req), upload.bytes, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/about-people/:id/photo', write, (req, res, next) => {
    people
      .removePhoto(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/about-people/:id', write, (req, res, next) => {
    people
      .remove(param(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

function actorFrom(req: Request): Actor {
  return {
    userId: req.user?.id ?? null,
    role: req.user?.role ?? null,
    ip: req.ip ?? null,
    requestId: req.id,
  };
}

function param(req: Request): string {
  const value = req.params.id;
  return typeof value === 'string' ? value : '';
}
