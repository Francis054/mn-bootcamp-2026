import { describe, expect, it } from 'vitest';
import type { AuditRepository } from '../../src/modules/auth/audit.repository.js';
import type { Actor } from '../../src/modules/curriculum/actor.js';
import { MemoryStorage } from '../../src/modules/storage/memory-storage.js';
import type { AboutPersonEntity } from '../../src/modules/about-people/about-person.entity.js';
import type { AboutPersonRepository } from '../../src/modules/about-people/about-person.repository.js';
import { AboutPersonService } from '../../src/modules/about-people/about-person.service.js';
import {
  descriptionMessage,
  groupMessage,
  nameMessage,
  titleMessage,
} from '../../src/modules/about-people/about-person.rules.js';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const ACTOR: Actor = { userId: 'editor-1', role: 'editor', ip: null, requestId: 'req-1' };

describe('about people rules', () => {
  it('asks for a group and a name, and allows a blank description', () => {
    expect(groupMessage('supporter')).toBe('Choose Founder, Team, or Partners.');
    expect(groupMessage('partner')).toBeUndefined();
    expect(nameMessage('  ')).toBe('Enter a name.');
    expect(nameMessage('Ama Boateng')).toBeUndefined();
    expect(titleMessage('')).toBeUndefined();
    expect(descriptionMessage(undefined)).toBeUndefined();
    expect(descriptionMessage('')).toBeUndefined();
    expect(descriptionMessage('A short note.')).toBeUndefined();
  });
});

describe('about people service', () => {
  it('keeps an unpublished person off the public list and allows an empty description', async () => {
    const { service, actions } = fixture();
    const created = await service.create(
      { group: 'partner', name: '  Ama Boateng  ', title: '', description: '' },
      ACTOR,
    );
    expect(created.group).toBe('partner');
    expect(created.name).toBe('Ama Boateng');
    expect(created.title).toBe('');
    expect(created.description).toBe('');
    expect(created.published).toBe(false);
    expect(created.photoUrl).toBeNull();
    expect(created).not.toHaveProperty('photoStorageKey');
    expect(await service.listPublic()).toEqual([]);

    const published = await service.update(created.id, { published: true }, ACTOR);
    expect(published.published).toBe(true);
    const visible = await service.listPublic();
    expect(visible.map((row) => row.name)).toEqual(['Ama Boateng']);
    expect(visible[0]).not.toHaveProperty('published');
    expect(visible[0]).not.toHaveProperty('photoStorageKey');
    expect(actions).toEqual([
      'curriculum.about_person.created',
      'curriculum.about_person.published',
    ]);
  });

  it('stores a photo, replaces it, and deletes the stored file with the person', async () => {
    const { service, storage } = fixture();
    const created = await service.create(
      { group: 'founder', name: 'Kwame Mensah', published: true },
      ACTOR,
    );
    const withPhoto = await service.replacePhoto(created.id, TINY_PNG, ACTOR);
    expect(withPhoto.photoUrl).toMatch(/^\/api\/v1\/public\/uploads\//);
    expect(withPhoto.width).toBe(1);
    expect(storage.objects.size).toBe(1);
    const firstKey = [...storage.objects.keys()][0];

    await service.replacePhoto(created.id, TINY_PNG, ACTOR);
    expect(storage.objects.size).toBe(1);
    expect(storage.objects.has(firstKey ?? '')).toBe(false);

    const cleared = await service.removePhoto(created.id, ACTOR);
    expect(cleared.photoUrl).toBeNull();
    expect(storage.objects.size).toBe(0);

    await service.replacePhoto(created.id, TINY_PNG, ACTOR);
    expect(storage.objects.size).toBe(1);
    await service.remove(created.id, ACTOR);
    expect(storage.objects.size).toBe(0);
    expect(await service.listPublic()).toEqual([]);
  });

  it('refuses a file that is not an image and orders founder, team, then partners', async () => {
    const { service } = fixture();
    const partner = await service.create(
      { group: 'partner', name: 'Partner One', published: true },
      ACTOR,
    );
    const team = await service.create({ group: 'team', name: 'Team One', published: true }, ACTOR);
    const founder = await service.create(
      { group: 'founder', name: 'Founder One', published: true },
      ACTOR,
    );
    expect((await service.listPublic()).map((row) => row.group)).toEqual([
      'founder',
      'team',
      'partner',
    ]);

    await expect(
      service.replacePhoto(founder.id, Buffer.from('not an image'), ACTOR),
    ).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { file: 'Use a JPEG, PNG, or WebP image.' },
    });

    const reordered = await service.reorder('team', [team.id], ACTOR);
    expect(reordered.find((row) => row.id === team.id)?.displayOrder).toBe(0);
    await expect(service.reorder('partner', [partner.id, 'missing'], ACTOR)).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it('leaves the row in place when storage cannot delete the photo', async () => {
    const { service, storage } = fixture();
    const created = await service.create({ group: 'team', name: 'Team Two' }, ACTOR);
    await service.replacePhoto(created.id, TINY_PNG, ACTOR);
    storage.failDeletes = true;
    await expect(service.remove(created.id, ACTOR)).rejects.toMatchObject({ code: 'server' });
    expect((await service.listAdmin()).map((row) => row.id)).toEqual([created.id]);
    expect(storage.objects.size).toBe(1);
  });
});

function fixture() {
  const rows: AboutPersonEntity[] = [];
  const people = {
    findAll: () => Promise.resolve([...rows]),
    findByGroup: (group: AboutPersonEntity['group']) =>
      Promise.resolve(rows.filter((row) => row.group === group)),
    findById: (id: string) => Promise.resolve(rows.find((row) => row.id === id) ?? null),
    insert: (person: Omit<AboutPersonEntity, 'createdAt' | 'updatedAt'>) => {
      const row: AboutPersonEntity = { ...person, createdAt: new Date(), updatedAt: new Date() };
      rows.push(row);
      return Promise.resolve(row);
    },
    save: (person: AboutPersonEntity) => {
      person.updatedAt = new Date();
      const index = rows.findIndex((row) => row.id === person.id);
      if (index >= 0) rows[index] = person;
      return Promise.resolve(person);
    },
    remove: (person: AboutPersonEntity) => {
      const index = rows.findIndex((row) => row.id === person.id);
      if (index >= 0) rows.splice(index, 1);
      return Promise.resolve();
    },
  };
  const actions: string[] = [];
  const audit = {
    record: (input: { action: string }) => {
      actions.push(input.action);
      return Promise.resolve();
    },
  };
  const storage = new MemoryStorage();
  const service = new AboutPersonService(
    people as unknown as AboutPersonRepository,
    audit as unknown as AuditRepository,
    storage,
    500,
  );
  return { service, storage, actions };
}
