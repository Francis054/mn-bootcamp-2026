import type { Role } from '../users/role.js';

/**
 * The same map as the website's `frontend/src/domain/permissions.ts`.
 * Screen checks are not the security boundary. These are.
 *
 * `content.read` opens `/api/v1/admin`. Trainee and trainer do not have it,
 * so they cannot read other trainees' private records. `portal.access` and
 * `portal.write` are the trainee's own area. No portal route uses them yet.
 */
export const PERMISSIONS = [
  'content.read',
  'content.write',
  'media.upload',
  'media.write',
  'users.read',
  'users.manage',
  'settings.manage',
  'account.manage',
  'portal.access',
  'portal.write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  trainee: ['portal.access', 'portal.write', 'account.manage'],
  trainer: ['account.manage'],
  viewer: ['content.read', 'account.manage'],
  editor: ['content.read', 'content.write', 'media.upload', 'media.write', 'account.manage'],
  administrator: [
    'content.read',
    'content.write',
    'media.upload',
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
