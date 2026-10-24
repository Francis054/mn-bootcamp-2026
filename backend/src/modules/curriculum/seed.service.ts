import type { ProjectRepository } from '../projects/project.repository.js';
import { buildSampleProjects } from '../projects/sample-projects.js';
import type { TraineeRepository } from '../trainees/trainee.repository.js';
import { buildSampleTrainees } from '../trainees/sample-trainees.js';
import {
  SAMPLE_MODULES,
  SAMPLE_PHASES,
  SAMPLE_TRACKS,
  buildSampleLessons,
} from './sample-catalogue.js';
import type {
  LessonRepository,
  ModuleRepository,
  PhaseRepository,
  TrackRepository,
} from './repositories.js';

/**
 * Insert the labelled sample rows when their ids are absent. Existing rows,
 * including ones an editor has changed, are left alone.
 */
export class SeedService {
  constructor(
    private readonly tracks: TrackRepository,
    private readonly modules: ModuleRepository,
    private readonly phases: PhaseRepository,
    private readonly lessons: LessonRepository,
    private readonly trainees: TraineeRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async run(): Promise<void> {
    for (const track of SAMPLE_TRACKS) {
      if (await this.tracks.findById(track.id)) continue;
      await this.tracks.insert(track);
    }
    for (const module of SAMPLE_MODULES) {
      if (await this.modules.findById(module.id)) continue;
      await this.modules.insert(module);
    }
    for (const phase of SAMPLE_PHASES) {
      if (await this.phases.findById(phase.id)) continue;
      await this.phases.insert(phase);
    }
    for (const lesson of buildSampleLessons()) {
      if (await this.lessons.findById(lesson.id)) continue;
      await this.lessons.insert(lesson);
    }
    for (const trainee of buildSampleTrainees()) {
      if (await this.trainees.findById(trainee.id)) continue;
      if (await this.trainees.findByEmail(trainee.email)) continue;
      await this.trainees.insert(trainee);
    }
    for (const project of buildSampleProjects()) {
      if (await this.projects.findById(project.id)) continue;
      const { traineeIds, ...row } = project;
      await this.projects.insert(row);
      await this.projects.replaceTrainees(project.id, traineeIds);
    }
  }
}
