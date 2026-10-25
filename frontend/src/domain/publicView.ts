import { stripKeys } from './publish';
import type { BootcampEvent, Lesson, Project, PublicEvent, PublicLesson, PublicProject, PublicTrainee, Trainee } from './types';

export function toPublicLesson(lesson: Lesson): PublicLesson {
  return stripKeys(lesson, ['internalNotes']);
}

export function toPublicTrainee(trainee: Trainee): PublicTrainee {
  return stripKeys(trainee, ['email', 'internalNotes', 'linkedin', 'portfolio', 'consentReceived', 'lessonIds']);
}

export function toPublicProject(project: Project): PublicProject {
  return stripKeys(project, ['internalNotes', 'repositoryUrl', 'demoUrl', 'shareAgreed', 'labOnlyConfirmed', 'traineeIds', 'lessonIds']);
}

export function toPublicEvent(event: BootcampEvent): PublicEvent {
  return stripKeys(event, ['internalNotes', 'lessonIds', 'projectIds', 'mediaIds']);
}
