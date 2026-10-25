import type { ContentRepository } from '../content/content.repository.js';
import { buildSampleContent } from '../content/sample-content.js';
import type { EventRepository } from '../events/event.repository.js';
import { buildSampleEvents } from '../events/sample-events.js';
import type { MediaRepository } from '../gallery/media.repository.js';
import { buildSampleMedia } from '../gallery/sample-media.js';
import type { ProjectRepository } from '../projects/project.repository.js';
import { buildSampleProjects } from '../projects/sample-projects.js';
import { SITE_IMAGE_SLOTS, siteImageSeedRow } from '../site-images/catalogue.js';
import type { SiteImageRepository } from '../site-images/site-image.repository.js';
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
    private readonly events: EventRepository,
    private readonly media: MediaRepository,
    private readonly content: ContentRepository,
    private readonly siteImages: SiteImageRepository,
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
    for (const event of buildSampleEvents()) {
      if (await this.events.findById(event.id)) continue;
      await this.events.insert(event);
    }
    for (const media of buildSampleMedia()) {
      if (await this.media.findById(media.id)) continue;
      await this.media.insert(media);
    }
    for (const document of buildSampleContent()) {
      if (await this.content.findById(document.id)) continue;
      await this.content.insert(document);
    }
    await this.siteImages.insertMissing(SITE_IMAGE_SLOTS.map(siteImageSeedRow));
  }
}
