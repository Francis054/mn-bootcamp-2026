import type { Permission, Role } from './types';

/** Central permission map. UI checks are for experience only.
 *  The development adapter re-checks these on every admin call.
 *  The API enforces the same map. `content.read` is the admin shell.
 */
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

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export const ROLE_LABEL: Record<Role, string> = {
  trainee: 'Trainee',
  trainer: 'Trainer',
  viewer: 'Viewer',
  editor: 'Editor',
  administrator: 'Administrator',
};

export const ROLE_CHOICE = 'Choose viewer, editor, trainer, trainee, or administrator.';
