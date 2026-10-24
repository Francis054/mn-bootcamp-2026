export const ROLES = ['viewer', 'editor', 'administrator'] as const;

export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  administrator: 2,
};

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role === value);
}

/** True when `actual` is the minimum role or a role above it. */
export function roleAtLeast(actual: Role, minimum: Role): boolean {
  return RANK[actual] >= RANK[minimum];
}
