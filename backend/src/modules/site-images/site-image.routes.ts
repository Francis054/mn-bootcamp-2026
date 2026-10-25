import { Router, type Request } from 'express';
import { requireRole } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { imageSizeMessage } from '../gallery/media.rules.js';
import { readMediaUpload } from '../gallery/upload.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import { SiteImageAltDto, SiteImageCreateDto } from './site-image.dto.js';
import type { SiteImageService } from './site-image.service.js';

export function mountPublicSiteImages(router: Router, images: SiteImageService): void {
  router.get('/public/site-images', (_req, res, next) => {
    images
      .listPublic()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.get('/public/site-images/:key', (req, res, next) => {
    images
      .getPublic(keyParam(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

export function mountAdminSiteImages(
  admin: Router,
  images: SiteImageService,
  maxBytes: number,
): void {
  const router = Router();
  router.use(requireRole('administrator'));
  router.get('/', (_req, res, next) => {
    images
      .listAdmin()
      .then((rows) => res.json(rows))
      .catch(next);
  });
  router.post('/', (req, res, next) => {
    validateDto(SiteImageCreateDto, req.body)
      .then((dto) => images.create(dto.key, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  router.patch('/:key', (req, res, next) => {
    validateDto(SiteImageAltDto, req.body)
      .then((dto) =>
        images.updateAlt(
          keyParam(req),
          dto.tagline === undefined ? { alt: dto.alt } : { alt: dto.alt, tagline: dto.tagline },
          actorFrom(req),
        ),
      )
      .then((row) => res.json(row))
      .catch(next);
  });
  router.post('/:key/image', (req, res, next) => {
    readMediaUpload(req, maxBytes, imageSizeMessage(maxBytes))
      .then((upload) =>
        images.replace(keyParam(req), { bytes: upload.bytes, alt: upload.alt }, actorFrom(req)),
      )
      .then((row) => res.json(row))
      .catch(next);
  });
  router.post('/:key/reset', (req, res, next) => {
    images
      .reset(keyParam(req), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.use('/site-images', router);
}

function actorFrom(req: Request): Actor {
  return {
    userId: req.user?.id ?? null,
    role: req.user?.role ?? null,
    ip: req.ip ?? null,
    requestId: req.id,
  };
}

function keyParam(req: Request): string {
  const value = req.params.key;
  return typeof value === 'string' ? value : '';
}
