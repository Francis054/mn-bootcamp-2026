export const ROLES = ['trainee', 'trainer', 'viewer', 'editor', 'administrator'] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_CHOICE = 'Choose viewer, editor, trainer, trainee, or administrator.';

/**
 * Trainee and trainer sit below viewer. `roleAtLeast` still treats
 * administrator as above editor, and editor as above viewer.
 */
const RANK: Record<Role, number> = {
  trainee: 0,
  trainer: 1,
  viewer: 2,
  editor: 3,
  administrator: 4,
};

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role === value);
}

/** True when `actual` is the minimum role or a role above it. */
export function roleAtLeast(actual: Role, minimum: Role): boolean {
  return RANK[actual] >= RANK[minimum];
}
