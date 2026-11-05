import { describe, expect, it } from 'vitest';
import { can } from '../../src/modules/auth/permissions.js';
import { roleAtLeast } from '../../src/modules/users/role.js';

describe('roles and permissions', () => {
  it('keeps staff permissions and keeps trainee and trainer out of admin', () => {
    expect(can('viewer', 'content.read')).toBe(true);
    expect(can('viewer', 'content.write')).toBe(false);
    expect(can('viewer', 'users.manage')).toBe(false);
    expect(can('viewer', 'media.upload')).toBe(false);
    expect(can('editor', 'content.read')).toBe(true);
    expect(can('editor', 'content.write')).toBe(true);
    expect(can('editor', 'media.write')).toBe(true);
    expect(can('editor', 'media.upload')).toBe(true);
    expect(can('editor', 'users.read')).toBe(false);
    expect(can('editor', 'settings.manage')).toBe(false);
    expect(can('administrator', 'content.read')).toBe(true);
    expect(can('administrator', 'content.write')).toBe(true);
    expect(can('administrator', 'media.upload')).toBe(true);
    expect(can('administrator', 'users.manage')).toBe(true);
    expect(can('administrator', 'settings.manage')).toBe(true);
    expect(can('trainee', 'content.read')).toBe(false);
    expect(can('trainee', 'media.upload')).toBe(false);
    expect(can('trainee', 'media.write')).toBe(false);
    expect(can('trainee', 'portal.access')).toBe(true);
    expect(can('trainee', 'portal.write')).toBe(true);
    expect(can('trainee', 'account.manage')).toBe(true);
    expect(can('trainer', 'content.read')).toBe(false);
    expect(can('trainer', 'media.upload')).toBe(false);
    expect(can('trainer', 'portal.access')).toBe(false);
    expect(can('trainer', 'account.manage')).toBe(true);
    expect(can('trainer', 'progress.read')).toBe(true);
    expect(can('trainee', 'progress.read')).toBe(false);
    expect(can('administrator', 'progress.read')).toBe(false);
    expect(roleAtLeast('administrator', 'editor')).toBe(true);
    expect(roleAtLeast('trainee', 'viewer')).toBe(false);
  });

  it('orders viewer, then editor, then administrator', () => {
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
    expect(roleAtLeast('viewer', 'editor')).toBe(false);
    expect(roleAtLeast('editor', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'administrator')).toBe(false);
    expect(roleAtLeast('administrator', 'editor')).toBe(true);
    expect(roleAtLeast('administrator', 'administrator')).toBe(true);
  });
});
