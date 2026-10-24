import { useMemo, useSyncExternalStore } from 'react';
import { isPubliclyListable } from '@/domain/publish';
import { toPublicEvent, toPublicLesson, toPublicProject, toPublicTrainee } from '@/domain/publicView';
import { getState, subscribe } from '@/dev/store';

/** Public pages read the in-memory adapter synchronously so the marketing
 *  site does not flash a skeleton. Mutations still go through api().
 *  Selectors strip private fields. The fixture module is still in the
 *  client bundle until a backend serves published projections only.
 */
export function useContent() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function usePublicContent() {
  const state = useContent();
  return useMemo(() => ({
    homepage: state.homepage,
    about: state.about,
    milestones: state.milestones,
    lessons: state.lessons.filter(isPubliclyListable).map(toPublicLesson),
    trainees: state.trainees.filter(isPubliclyListable).map(toPublicTrainee),
    projects: state.projects.filter(isPubliclyListable).map(toPublicProject),
    events: state.events.filter(isPubliclyListable).map(toPublicEvent),
    media: state.media.filter(isPubliclyListable),
  }), [state]);
}
