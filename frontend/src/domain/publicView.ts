import { stripKeys } from './publish';
import type { BootcampEvent, Lesson, Project, PublicEvent, PublicLesson, PublicProject, PublicTrainee, Trainee } from './types';

export function toPublicLesson(lesson: Lesson): PublicLesson {
  return stripKeys(lesson, ['internalNotes']);
}

export function toPublicTrainee(trainee: Trainee): PublicTrainee {
  const base = stripKeys(trainee, ['email', 'internalNotes', 'linkedin', 'portfolio', 'githubUrl', 'consentReceived', 'lessonIds', 'photoConsent', 'publicLinks']);
  const showPhoto = trainee.photoConsent !== false;
  return {
    ...base,
    photoUrl: showPhoto ? trainee.photoUrl : null,
    ...(trainee.publicLinks && trainee.linkedin ? { linkedin: trainee.linkedin } : {}),
    ...(trainee.publicLinks && trainee.githubUrl ? { githubUrl: trainee.githubUrl } : {}),
    ...(trainee.publicLinks && trainee.portfolio ? { portfolio: trainee.portfolio } : {}),
  };
}

export function toPublicProject(project: Project): PublicProject {
  return stripKeys(project, ['internalNotes', 'repositoryUrl', 'demoUrl', 'shareAgreed', 'labOnlyConfirmed', 'traineeIds', 'lessonIds']);
}

export function toPublicEvent(event: BootcampEvent): PublicEvent {
  return stripKeys(event, ['internalNotes', 'lessonIds', 'projectIds', 'mediaIds']);
}
