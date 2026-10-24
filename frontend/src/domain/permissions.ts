import type { Permission, Role } from './types';

/** Central permission map. UI checks are for experience only.
 *  The development adapter re-checks these on every mutation.
 *  A future backend must enforce them independently.
 */
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
  viewer: 'Viewer',
  editor: 'Editor',
  administrator: 'Administrator',
};
