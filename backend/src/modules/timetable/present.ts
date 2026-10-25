import type { ParsedProgramme, PublicTimetable, TrainerRef } from './model.js';

/** The same public shape the API returns, without the request-time clock. */
export function presentParsed(parsed: ParsedProgramme): Omit<PublicTimetable, 'today' | 'currentWeek'> & {
  sourceNote: string;
  warnings: ParsedProgramme['warnings'];
} {
  const trainerById = new Map(parsed.trainers.map((trainer) => [trainer.id, trainer]));
  const ref = (id: string): TrainerRef | undefined => {
    const trainer = trainerById.get(id);
    if (!trainer) return undefined;
    return {
      id: trainer.id,
      displayName: trainer.displayName,
      proposed: trainer.proposed,
      kind: trainer.kind,
    };
  };
  const refs = (ids: Array<{ trainerId: string; sortOrder: number }>): TrainerRef[] =>
    [...ids]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((link) => {
        const trainer = ref(link.trainerId);
        return trainer ? [trainer] : [];
      });
  return {
    programme: {
      id: parsed.id,
      name: parsed.name,
      startsOn: parsed.startsOn,
      endsOn: parsed.endsOn,
      rules: parsed.rules,
    },
    sourceNote: parsed.sourceNote,
    warnings: parsed.warnings,
    trainers: parsed.trainers.map((trainer) => ({
      id: trainer.id,
      displayName: trainer.displayName,
      proposed: trainer.proposed,
      kind: trainer.kind,
    })),
    blocks: parsed.blocks.map((block) => ({
      id: block.id,
      sortOrder: block.sortOrder,
      name: block.name,
      professionalismTheme: block.professionalismTheme,
      cybersecurityTheme: block.cybersecurityTheme,
      weeks: parsed.weeks
        .filter((week) => week.blockId === block.id)
        .map((week) => ({
          id: week.id,
          number: week.number,
          title: week.title,
          startsOn: week.startsOn,
          professionalism: week.professionalism,
          cybersecurity: week.cybersecurity,
          deliverables: parsed.deliverables
            .filter((item) => item.weekId === week.id)
            .map((item) => ({ id: item.id, sortOrder: item.sortOrder, title: item.title })),
          professionalismTrainers: refs(
            parsed.weekTrainers.filter((link) => link.weekId === week.id && link.role === 'professionalism'),
          ),
          cybersecurityTrainers: refs(
            parsed.weekTrainers.filter((link) => link.weekId === week.id && link.role === 'cybersecurity'),
          ),
          sessions: parsed.sessions
            .filter((session) => session.weekId === week.id)
            .map((session) => ({
              id: session.id,
              date: session.date,
              day: session.day,
              sortOrder: session.sortOrder,
              type: session.type,
              activity: session.activity,
              topic: session.topic,
              notes: session.notes,
              startTime: session.startTime,
              endTime: session.endTime,
              trainerStatus: session.trainerStatus,
              trainers: refs(parsed.sessionTrainers.filter((link) => link.sessionId === session.id)),
            })),
        })),
    })),
  };
}
