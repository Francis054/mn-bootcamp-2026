import type { Repository } from 'typeorm';
import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { LessonEntity } from './lesson.entity.js';
import type { ModuleEntity } from './module.entity.js';
import type { PhaseEntity } from './phase.entity.js';
import type { TrackEntity } from './track.entity.js';

export class TrackRepository extends BaseRepository<TrackEntity> {
  findAll(): Promise<TrackEntity[]> {
    return this.repository.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  findByName(name: string): Promise<TrackEntity | null> {
    return this.repository.findOne({ where: { name } });
  }

  insert(track: Omit<TrackEntity, 'createdAt' | 'updatedAt'>): Promise<TrackEntity> {
    return this.repository.save(this.repository.create(track));
  }

  async remove(track: TrackEntity): Promise<void> {
    await this.repository.remove(track);
  }
}

export class ModuleRepository extends BaseRepository<ModuleEntity> {
  findAll(): Promise<ModuleEntity[]> {
    return this.repository.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  findByName(name: string): Promise<ModuleEntity | null> {
    return this.repository.findOne({ where: { name } });
  }

  insert(module: Omit<ModuleEntity, 'createdAt' | 'updatedAt'>): Promise<ModuleEntity> {
    return this.repository.save(this.repository.create(module));
  }

  async remove(module: ModuleEntity): Promise<void> {
    await this.repository.remove(module);
  }
}

export class PhaseRepository {
  constructor(private readonly repository: Repository<PhaseEntity>) {}

  findAll(): Promise<PhaseEntity[]> {
    return this.repository.find({ order: { id: 'ASC' } });
  }

  findById(id: number): Promise<PhaseEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  insert(phase: Omit<PhaseEntity, 'createdAt' | 'updatedAt'>): Promise<PhaseEntity> {
    return this.repository.save(this.repository.create(phase));
  }

  save(phase: PhaseEntity): Promise<PhaseEntity> {
    return this.repository.save(phase);
  }

  async remove(phase: PhaseEntity): Promise<void> {
    await this.repository.remove(phase);
  }
}

export class LessonRepository extends BaseRepository<LessonEntity> {
  findAll(): Promise<LessonEntity[]> {
    return this.repository.find({ order: { week: 'ASC', title: 'ASC' } });
  }

  countByModule(moduleId: string): Promise<number> {
    return this.repository.count({ where: { moduleId } });
  }

  countByPhase(phase: number): Promise<number> {
    return this.repository.count({ where: { phase } });
  }

  insert(lesson: Omit<LessonEntity, 'createdAt' | 'updatedAt'>): Promise<LessonEntity> {
    return this.repository.save(this.repository.create(lesson));
  }

  async remove(lesson: LessonEntity): Promise<void> {
    await this.repository.remove(lesson);
  }
}
