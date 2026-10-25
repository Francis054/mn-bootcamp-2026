import { groupedIds, replaceIds } from '../../shared/persistence/id-links.js';
import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { ProjectEntity } from './project.entity.js';

export class ProjectRepository extends BaseRepository<ProjectEntity> {
  findAll(): Promise<ProjectEntity[]> {
    return this.repository.find({ order: { title: 'ASC', id: 'ASC' } });
  }

  countByModule(moduleId: string): Promise<number> {
    return this.repository.count({ where: { moduleId } });
  }

  countByTrainee(traineeId: string): Promise<number> {
    return this.repository.manager
      .query('SELECT count(*)::int AS total FROM project_trainees WHERE trainee_id = $1', [
        traineeId,
      ])
      .then((value: unknown) => readCount(value));
  }

  async traineeIdsByProject(projectIds: readonly string[]): Promise<Map<string, string[]>> {
    const grouped = new Map<string, string[]>();
    if (projectIds.length === 0) return grouped;
    const rows: unknown = await this.repository.manager.query(
      `SELECT project_id, trainee_id
       FROM project_trainees
       WHERE project_id = ANY($1::varchar[])
       ORDER BY trainee_id`,
      [projectIds],
    );
    for (const row of readLinkRows(rows)) {
      const list = grouped.get(row.projectId) ?? [];
      list.push(row.traineeId);
      grouped.set(row.projectId, list);
    }
    return grouped;
  }

  async replaceTrainees(projectId: string, traineeIds: readonly string[]): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await manager.query('DELETE FROM project_trainees WHERE project_id = $1', [projectId]);
      for (const traineeId of traineeIds) {
        await manager.query(
          'INSERT INTO project_trainees (project_id, trainee_id) VALUES ($1, $2)',
          [projectId, traineeId],
        );
      }
    });
  }

  lessonIdsByProject(projectIds: readonly string[]): Promise<Map<string, string[]>> {
    return groupedIds(
      (sql, params) => this.repository.manager.query(sql, params),
      'project_lessons',
      projectIds,
    );
  }

  replaceLessons(projectId: string, lessonIds: readonly string[]): Promise<void> {
    return this.repository.manager.transaction((manager) =>
      replaceIds(
        (sql, params) => manager.query(sql, params),
        'project_lessons',
        projectId,
        lessonIds,
      ),
    );
  }

  insert(project: Omit<ProjectEntity, 'createdAt' | 'updatedAt'>): Promise<ProjectEntity> {
    return this.repository.save(this.repository.create(project));
  }

  async remove(project: ProjectEntity): Promise<void> {
    await this.repository.remove(project);
  }
}

function readCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  const row: unknown = value[0];
  if (typeof row !== 'object' || row === null || !('total' in row)) return 0;
  const total = row.total;
  return typeof total === 'number' ? total : 0;
}

function readLinkRows(value: unknown): { projectId: string; traineeId: string }[] {
  if (!Array.isArray(value)) return [];
  const rows: { projectId: string; traineeId: string }[] = [];
  for (const entry of value) {
    const item: unknown = entry;
    if (typeof item !== 'object' || item === null) continue;
    if (!('project_id' in item) || !('trainee_id' in item)) continue;
    const projectId: unknown = item.project_id;
    const traineeId: unknown = item.trainee_id;
    if (typeof projectId !== 'string' || typeof traineeId !== 'string') continue;
    rows.push({ projectId, traineeId });
  }
  return rows;
}
