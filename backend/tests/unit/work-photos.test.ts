import { describe, expect, it } from 'vitest';
import type { AuditRepository } from '../../src/modules/auth/audit.repository.js';
import type { Actor } from '../../src/modules/curriculum/actor.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import type { ProjectRepository } from '../../src/modules/projects/project.repository.js';
import type { TraineeRepository } from '../../src/modules/trainees/trainee.repository.js';
import type { WorkPhotoEntity } from '../../src/modules/work-photos/work-photo.entity.js';
import type { WorkPhotoRepository } from '../../src/modules/work-photos/work-photo.repository.js';
import {
  WorkPhotoService,
  isPublicWorkPhoto,
} from '../../src/modules/work-photos/work-photo.service.js';
import {
  projectIdMessage,
  traineeIdMessage,
} from '../../src/modules/work-photos/work-photo.rules.js';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const ACTOR: Actor = { userId: 'admin-1', role: 'administrator', ip: null, requestId: 'req-1' };

describe('work photo rules', () => {
  it('asks for a trainee and allows a blank project', () => {
    expect(traineeIdMessage('')).toBe('Choose a trainee.');
    expect(traineeIdMessage('trainee 1')).toBe('Choose a trainee.');
    expect(traineeIdMessage('1')).toBeUndefined();
    expect(projectIdMessage('')).toBeUndefined();
    expect(projectIdMessage('not a project')).toBe('Choose a project.');
    expect(projectIdMessage('lab-1')).toBeUndefined();
  });

  it('treats a published public photo as visible and keeps a draft hidden', () => {
    expect(isPublicWorkPhoto({ publicationStatus: 'draft', listing: 'hidden' })).toBe(false);
    expect(isPublicWorkPhoto({ publicationStatus: 'published', listing: 'hidden' })).toBe(false);
    expect(isPublicWorkPhoto({ publicationStatus: 'published', listing: 'public' })).toBe(true);
  });
});

describe('work photo service', () => {
  it('keeps an upload private until an administrator publishes it', async () => {
    const { service, storage, actions } = fixture();
    const created = await service.createUpload(
      {
        traineeId: '1',
        projectId: 'p1',
        alt: 'Hands on a laptop in the lab.',
        caption: '',
        bytes: TINY_PNG,
      },
      ACTOR,
    );
    expect(created.publicationStatus).toBe('draft');
    expect(created.listing).toBe('hidden');
    expect(created.projectId).toBe('p1');
    expect(created.src.startsWith('memory:')).toBe(true);
    expect(created).not.toHaveProperty('storageKey');
    expect(await service.listPublic({})).toEqual([]);
    expect(storage.objects.size).toBe(1);

    const published = await service.publish(created.id, ACTOR);
    expect(published.publicationStatus).toBe('published');
    expect(published.listing).toBe('public');
    const visible = await service.listPublic({ traineeId: '1' });
    expect(visible.map((row) => row.id)).toEqual([created.id]);
    const shown = visible[0];
    if (!shown) throw new Error('Expected the published photo.');
    expect(shown).not.toHaveProperty('publicationStatus');
    expect(shown).not.toHaveProperty('uploadedBy');

    const hidden = await service.unpublish(created.id, ACTOR);
    expect(hidden.publicationStatus).toBe('draft');
    expect(await service.listPublic({ traineeId: '1' })).toEqual([]);

    const file = await service.open(created.id, 'admin');
    expect(file.kind).toBe('bytes');
    await expect(service.open(created.id, 'public')).rejects.toMatchObject({ code: 'not_found' });

    await service.remove(created.id, ACTOR);
    expect(storage.objects.size).toBe(0);
    expect(actions).toEqual([
      'curriculum.work_photo.created',
      'curriculum.work_photo.published',
      'curriculum.work_photo.unpublished',
      'curriculum.work_photo.deleted',
    ]);
  });

  it('refuses a file that is not an image, a photo that is too large, and the wrong project', async () => {
    const { service } = fixture();
    await expect(
      service.createUpload(
        {
          traineeId: '1',
          projectId: '',
          alt: 'A labelled drawing.',
          caption: '',
          bytes: Buffer.from('not-an-image'),
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'validation' });

    await expect(
      service.createUpload(
        {
          traineeId: '1',
          projectId: '',
          alt: 'A labelled drawing.',
          caption: '',
          bytes: Buffer.alloc(200, 1),
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ code: 'validation' });

    await expect(
      service.createUpload(
        {
          traineeId: '2',
          projectId: 'p1',
          alt: 'A labelled drawing.',
          caption: '',
          bytes: TINY_PNG,
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      fieldErrors: { projectId: 'Choose a project this trainee is on.' },
    });

    await expect(
      service.createUpload(
        {
          traineeId: 'missing',
          projectId: '',
          alt: 'A labelled drawing.',
          caption: '',
          bytes: TINY_PNG,
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ fieldErrors: { traineeId: 'Choose a trainee.' } });

    const loose = await service.createUpload(
      {
        traineeId: '2',
        projectId: '',
        alt: 'A labelled drawing.',
        caption: 'At the bench.',
        bytes: TINY_PNG,
      },
      ACTOR,
    );
    expect(loose.projectId).toBeNull();
    expect(loose.caption).toBe('At the bench.');
  });

  it('redirects a Cloudinary address and does not expose another host', async () => {
    const { service, photos } = fixture();
    const created = await service.createUpload(
      { traineeId: '1', projectId: '', alt: 'A labelled drawing.', caption: '', bytes: TINY_PNG },
      ACTOR,
    );
    const row = photos.rows.find((item) => item.id === created.id);
    if (!row) throw new Error('The photo was not stored.');
    row.src = 'https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg';
    await service.publish(created.id, ACTOR);
    const file = await service.open(created.id, 'public');
    expect(file).toEqual({ kind: 'redirect', url: row.src });

    row.src = 'https://example.test/secret.jpg';
    const foreign = await service.open(created.id, 'public');
    expect(foreign.kind).toBe('bytes');
  });
});

function fixture(): {
  service: WorkPhotoService;
  storage: MemoryStorage;
  photos: FakePhotos;
  actions: string[];
} {
  const photos = new FakePhotos();
  const storage = new MemoryStorage();
  const actions: string[] = [];
  const trainees = {
    findById: (id: string) => Promise.resolve(id === '1' || id === '2' ? ({ id } as never) : null),
  };
  const projects = {
    findById: (id: string) => Promise.resolve(id === 'p1' ? ({ id } as never) : null),
    traineeIdsByProject: (ids: readonly string[]) => {
      const links = new Map<string, string[]>();
      if (ids.includes('p1')) links.set('p1', ['1']);
      return Promise.resolve(links);
    },
  };
  const audit = {
    record: (event: { action: string }) => {
      actions.push(event.action);
      return Promise.resolve();
    },
  };
  const service = new WorkPhotoService(
    photos as unknown as WorkPhotoRepository,
    trainees as unknown as TraineeRepository,
    projects as unknown as ProjectRepository,
    audit as unknown as AuditRepository,
    storage,
    100,
  );
  return { service, storage, photos, actions };
}

class FakePhotos {
  rows: WorkPhotoEntity[] = [];

  findById(id: string): Promise<WorkPhotoEntity | null> {
    return Promise.resolve(this.rows.find((row) => row.id === id) ?? null);
  }

  findFiltered(filter: { traineeId?: string; projectId?: string }): Promise<WorkPhotoEntity[]> {
    return Promise.resolve(
      this.rows.filter((row) => {
        if (filter.traineeId !== undefined && row.traineeId !== filter.traineeId) return false;
        if (filter.projectId !== undefined && row.projectId !== filter.projectId) return false;
        return true;
      }),
    );
  }

  insert(photo: Omit<WorkPhotoEntity, 'createdAt' | 'updatedAt'>): Promise<WorkPhotoEntity> {
    const saved = { ...photo, createdAt: new Date(), updatedAt: new Date() };
    this.rows.push(saved);
    return Promise.resolve(saved);
  }

  save(photo: WorkPhotoEntity): Promise<WorkPhotoEntity> {
    photo.updatedAt = new Date();
    return Promise.resolve(photo);
  }

  remove(photo: WorkPhotoEntity): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== photo.id);
    return Promise.resolve();
  }
}
