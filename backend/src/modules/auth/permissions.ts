import type { Role } from '../users/role.js';

/**
 * The same map as the website's `frontend/src/domain/permissions.ts`.
 * Screen checks are not the security boundary. These are.
 *
 * `content.read` opens `/api/v1/admin`. Trainee and trainer do not have it,
 * so they cannot read other trainees' private records. `portal.access` opens
 * `/api/v1/portal`. `portal.write` saves the signed-in trainee's own profile,
 * photo, consent, skills, events, CV, and journey milestones. `progress.read` lets a trainer whose
 * login is linked on the timetable read skills and events. It does not open `/admin`.
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
  'progress.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  trainee: ['portal.access', 'portal.write', 'account.manage'],
  trainer: ['account.manage', 'progress.read'],
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
