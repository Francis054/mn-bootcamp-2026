export const PROJECT_TYPES = ['Lab', 'CTF', 'Case study', 'Community project', 'Capstone'] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value);
}
