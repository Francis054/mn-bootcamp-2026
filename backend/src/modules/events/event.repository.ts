import { groupedIds, replaceIds, type LinkTable } from '../../shared/persistence/id-links.js';
import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { EventEntity } from './event.entity.js';

export class EventRepository extends BaseRepository<EventEntity> {
  findAll(): Promise<EventEntity[]> {
    return this.repository.find({ order: { date: 'ASC', id: 'ASC' } });
  }

  insert(event: Omit<EventEntity, 'createdAt' | 'updatedAt'>): Promise<EventEntity> {
    return this.repository.save(this.repository.create(event));
  }

  async remove(event: EventEntity): Promise<void> {
    await this.repository.remove(event);
  }

  lessonIdsByEvent(eventIds: readonly string[]): Promise<Map<string, string[]>> {
    return this.links('event_lessons', eventIds);
  }

  projectIdsByEvent(eventIds: readonly string[]): Promise<Map<string, string[]>> {
    return this.links('event_projects', eventIds);
  }

  mediaIdsByEvent(eventIds: readonly string[]): Promise<Map<string, string[]>> {
    return this.links('event_media', eventIds);
  }

  replaceLessons(eventId: string, lessonIds: readonly string[]): Promise<void> {
    return this.replace('event_lessons', eventId, lessonIds);
  }

  replaceProjects(eventId: string, projectIds: readonly string[]): Promise<void> {
    return this.replace('event_projects', eventId, projectIds);
  }

  replaceMedia(eventId: string, mediaIds: readonly string[]): Promise<void> {
    return this.replace('event_media', eventId, mediaIds);
  }

  private links(table: LinkTable, parentIds: readonly string[]): Promise<Map<string, string[]>> {
    return groupedIds(
      (sql, params) => this.repository.manager.query(sql, params),
      table,
      parentIds,
    );
  }

  private replace(table: LinkTable, parentId: string, childIds: readonly string[]): Promise<void> {
    return this.repository.manager.transaction((manager) =>
      replaceIds((sql, params) => manager.query(sql, params), table, parentId, childIds),
    );
  }
}
