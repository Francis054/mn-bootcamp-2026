import type { Role } from '../users/role.js';

/**
 * The same map as the website's `web/src/domain/permissions.ts`.
 * Screen checks are not the security boundary. These are.
 */
export const PERMISSIONS = [
  'content.read',
  'content.write',
  'media.write',
  'users.read',
  'users.manage',
  'settings.manage',
  'account.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ['content.read', 'account.manage'],
  editor: ['content.read', 'content.write', 'media.write', 'account.manage'],
  administrator: [
    'content.read',
    'content.write',
    'media.write',
    'users.read',
    'users.manage',
    'settings.manage',
    'account.manage',
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
