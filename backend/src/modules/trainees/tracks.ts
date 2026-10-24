/** The approved track names. The form's "General" and the fixture's "GRC & awareness" are not accepted. */
export const TRAINEE_TRACKS = ['Blue team', 'Red team', 'GRC & Awareness'] as const;

export type TraineeTrack = (typeof TRAINEE_TRACKS)[number];

export function isTraineeTrack(value: string): value is TraineeTrack {
  return (TRAINEE_TRACKS as readonly string[]).includes(value);
}
