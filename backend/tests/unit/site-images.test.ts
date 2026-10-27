import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS } from '../../src/modules/auth/audit-event.entity.js';
import type { AuditRepository } from '../../src/modules/auth/audit.repository.js';
import type { Actor } from '../../src/modules/curriculum/actor.js';
import { SITE_IMAGE_SLOTS, siteImageSeedRow } from '../../src/modules/site-images/catalogue.js';
import { publicImageUrl } from '../../src/modules/site-images/image-url.js';
import type { SiteImageEntity } from '../../src/modules/site-images/site-image.entity.js';
import type {
  SiteImageInsert,
  SiteImageRepository,
} from '../../src/modules/site-images/site-image.repository.js';
import { SiteImageService } from '../../src/modules/site-images/site-image.service.js';
import { ApiError } from '../../src/shared/errors/api-error.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const ACTOR: Actor = {
  userId: '11111111-1111-1111-1111-111111111111',
  role: 'administrator',
  ip: null,
  requestId: 'req-site-images',
};

describe('site image catalogue', () => {
  it('keeps stable keys and bundled addresses the website can paint', () => {
    const keys = SITE_IMAGE_SLOTS.map((slot) => slot.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      'community-logo',
      'foundation-logo',
      'home-hero-main',
      'home-hero-side',
      'home-hero-accent',
      'home-class-peek-1',
      'home-class-peek-2',
      'home-class-peek-3',
      'home-class-peek-4',
      'bootcamp-banner',
      'about-banner',
      'sign-in-panel',
    ]);
    for (const slot of SITE_IMAGE_SLOTS) {
      expect(slot.label.length).toBeGreaterThan(0);
      expect(slot.label.length).toBeLessThanOrEqual(120);
      expect(slot.description.length).toBeGreaterThan(0);
      expect(slot.description.length).toBeLessThanOrEqual(400);
      expect(slot.alt.length).toBeLessThanOrEqual(300);
      expect(publicImageUrl(slot.url)).toBe(slot.url);
      expect(slot.width).toBeGreaterThan(0);
      expect(slot.height).toBeGreaterThan(0);
    }
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../frontend/src/domain/siteImages.ts',
      ),
      'utf8',
    );
    for (const slot of SITE_IMAGE_SLOTS) {
      expect(source).toContain(`key: '${slot.key}'`);
      expect(source).toContain(`url: '${slot.url}'`);
      expect(source).toContain(`alt: '${slot.alt}'`);
      expect(source).toContain(`label: '${slot.label}'`);
    }
  });

  it('accepts bundled files, local uploads, and https, and drops anything else', () => {
    expect(publicImageUrl('/assets/img/electronics-lab-1600.webp')).toBe(
      '/assets/img/electronics-lab-1600.webp',
    );
    expect(publicImageUrl('/assets/logo/maxim-nyansa-foundation-logo.png')).toBe(
      '/assets/logo/maxim-nyansa-foundation-logo.png',
    );
    const local = '/api/v1/public/uploads/11111111-1111-1111-1111-111111111111';
    expect(publicImageUrl(local)).toBe(local);
    expect(publicImageUrl('https://res.cloudinary.com/demo/image/upload/v1/mn/a.jpg')).toContain(
      'https://',
    );
    expect(publicImageUrl('http://example.test/a.jpg')).toBeUndefined();
    expect(publicImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(publicImageUrl('//cdn.example/a.jpg')).toBeUndefined();
    expect(publicImageUrl('/assets/../secret.webp')).toBeUndefined();
    expect(publicImageUrl('https://user:pass@cdn.example/a.jpg')).toBeUndefined();
    expect(publicImageUrl('memory:abc')).toBeUndefined();
  });
});

describe('site image service', () => {
  it('records the audit actions', () => {
    expect(AUDIT_ACTIONS).toContain('curriculum.site_image.created');
    expect(AUDIT_ACTIONS).toContain('curriculum.site_image.updated');
  });

  it('replaces a slot, keeps a bad address off the public list, and resets', async () => {
    const repo = new MemoryImages();
    const storage = new MemoryStorage();
    const actions: string[] = [];
    const service = new SiteImageService(repo.asRepo(), auditOf(actions), storage, 500);
    for (const slot of SITE_IMAGE_SLOTS) {
      await repo.insert({ ...siteImageSeedRow(slot), updatedBy: null });
    }

    const before = await service.listPublic();
    expect(before).toHaveLength(SITE_IMAGE_SLOTS.length);
    expect(before[0]?.url).toBe('/assets/logo/community-badge.webp');
    expect(before[0]?.tagline).toBe('STRONGER TOGETHER');
    expect(before.find((row) => row.key === 'foundation-logo')?.url).toBe(
      '/assets/logo/maxim-nyansa-foundation-logo.png',
    );
    expect(JSON.stringify(before)).not.toContain('storageKey');
    expect(JSON.stringify(before)).not.toContain('updatedBy');

    const replaced = await service.replace(
      'foundation-logo',
      { bytes: TINY_PNG, alt: 'A temporary wordmark' },
      ACTOR,
    );
    expect(replaced.usingDefault).toBe(false);
    expect(replaced.url).toMatch(/^\/api\/v1\/public\/uploads\/[0-9a-f-]{36}$/i);
    expect(replaced.width).toBe(1);
    expect(replaced.height).toBe(1);
    expect(replaced.alt).toBe('A temporary wordmark');
    expect(storage.objects.size).toBe(1);
    expect(actions).toContain('curriculum.site_image.updated');

    const logo = repo.rows.find((row) => row.key === 'foundation-logo');
    if (!logo) throw new Error('Expected the logo row.');
    logo.url = 'javascript:alert(1)';
    const hidden = (await service.listPublic()).find((row) => row.key === 'foundation-logo');
    expect(hidden?.url).toBe('/assets/logo/maxim-nyansa-foundation-logo.png');

    logo.url = replaced.url;
    const restored = await service.reset('foundation-logo', ACTOR);
    expect(restored.usingDefault).toBe(true);
    expect(restored.url).toBe('/assets/logo/maxim-nyansa-foundation-logo.png');
    expect(restored.alt).toBe('Maxim Nyansa Foundation logo');
    expect(storage.objects.size).toBe(0);

    const again = await service.reset('foundation-logo', ACTOR);
    expect(again.usingDefault).toBe(true);
  });

  it('rejects a second create, a huge file, and text that is not an image', async () => {
    const repo = new MemoryImages();
    const storage = new MemoryStorage();
    const service = new SiteImageService(repo.asRepo(), auditOf([]), storage, 500);
    const created = await service.create('about-banner', ACTOR);
    expect(created.usingDefault).toBe(true);
    expect(created.url).toBe('/assets/img/anniversary-group-outdoor-1600.webp');

    await expect(service.create('about-banner', ACTOR)).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { key: 'That image slot already exists.' },
    });
    await expect(service.create('not-a-slot', ACTOR)).rejects.toBeInstanceOf(ApiError);
    await expect(
      service.replace('missing', { bytes: TINY_PNG, alt: 'Hello' }, ACTOR),
    ).rejects.toMatchObject({
      code: 'not_found',
    });

    const tooBig = await service
      .replace('about-banner', { bytes: Buffer.alloc(600, 1), alt: 'Too big' }, ACTOR)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(tooBig).toBeInstanceOf(ApiError);
    expect(tooBig).toMatchObject({ fieldErrors: { file: 'Use an image of at most 500 bytes.' } });

    const fake = await service
      .replace('about-banner', { bytes: Buffer.from('not-a-png'), alt: 'Nope' }, ACTOR)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(fake).toMatchObject({ fieldErrors: { file: 'Use a JPEG, PNG, or WebP image.' } });

    const longAlt = await service.updateAlt('about-banner', { alt: 'x'.repeat(301) }, ACTOR).then(
      () => null,
      (error: unknown) => error,
    );
    expect(longAlt).toMatchObject({ fieldErrors: { alt: 'Use at most 300 characters.' } });

    const cleared = await service.updateAlt('about-banner', { alt: '   ' }, ACTOR);
    expect(cleared.alt).toBe('');
    expect(storage.objects.size).toBe(0);
  });

  it('leaves the new file in place when the previous upload cannot be deleted', async () => {
    const repo = new MemoryImages();
    const storage = new MemoryStorage();
    const service = new SiteImageService(repo.asRepo(), auditOf([]), storage, 5_000_000);
    const logoSlot = SITE_IMAGE_SLOTS.find((slot) => slot.key === 'foundation-logo');
    if (!logoSlot) throw new Error('Expected the foundation plate slot.');
    await repo.insert({ ...siteImageSeedRow(logoSlot), updatedBy: null });
    await service.replace('foundation-logo', { bytes: TINY_PNG, alt: 'First' }, ACTOR);
    storage.failDeletes = true;
    await expect(
      service.replace('foundation-logo', { bytes: TINY_PNG, alt: 'Second' }, ACTOR),
    ).rejects.toMatchObject({
      message: 'The new image is saved. The previous file could not be removed.',
    });
    const current = (await service.listAdmin()).find((row) => row.key === 'foundation-logo');
    expect(current?.alt).toBe('Second');
    expect(current?.usingDefault).toBe(false);
  });
});

class MemoryImages {
  rows: SiteImageEntity[] = [];

  findAll(): Promise<SiteImageEntity[]> {
    return Promise.resolve(this.rows.map(clone));
  }

  findByKey(key: string): Promise<SiteImageEntity | null> {
    const found = this.rows.find((row) => row.key === key);
    return Promise.resolve(found ? clone(found) : null);
  }

  insert(row: SiteImageInsert): Promise<SiteImageEntity> {
    if (this.rows.some((item) => item.key === row.key)) {
      const error = new Error('duplicate') as Error & { code: string };
      error.code = '23505';
      return Promise.reject(error);
    }
    const saved: SiteImageEntity = {
      ...row,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    };
    this.rows.push(saved);
    return Promise.resolve(clone(saved));
  }

  save(row: SiteImageEntity): Promise<SiteImageEntity> {
    const index = this.rows.findIndex((item) => item.key === row.key);
    const saved = clone(row);
    saved.updatedAt = new Date('2026-10-02T00:00:00.000Z');
    if (index >= 0) this.rows[index] = saved;
    return Promise.resolve(clone(saved));
  }

  asRepo(): SiteImageRepository {
    return this as unknown as SiteImageRepository;
  }
}

function clone(row: SiteImageEntity): SiteImageEntity {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    url: row.url,
    alt: row.alt,
    width: row.width,
    height: row.height,
    fit: row.fit,
    defaultUrl: row.defaultUrl,
    defaultAlt: row.defaultAlt,
    defaultWidth: row.defaultWidth,
    defaultHeight: row.defaultHeight,
    tagline: row.tagline,
    defaultTagline: row.defaultTagline,
    storageProvider: row.storageProvider,
    storageKey: row.storageKey,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditOf(actions: string[]): AuditRepository {
  return {
    record: (input: { action: string }) => {
      actions.push(input.action);
      return Promise.resolve();
    },
  } as unknown as AuditRepository;
}
