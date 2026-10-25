import { describe, expect, it } from 'vitest';
import { can } from '../../src/modules/auth/permissions.js';
import { roleAtLeast } from '../../src/modules/users/role.js';

describe('roles and permissions', () => {
  it('keeps the website permission map', () => {
    expect(can('viewer', 'content.read')).toBe(true);
    expect(can('viewer', 'content.write')).toBe(false);
    expect(can('viewer', 'users.manage')).toBe(false);
    expect(can('editor', 'content.write')).toBe(true);
    expect(can('editor', 'media.write')).toBe(true);
    expect(can('editor', 'users.read')).toBe(false);
    expect(can('editor', 'settings.manage')).toBe(false);
    expect(can('administrator', 'users.manage')).toBe(true);
    expect(can('administrator', 'settings.manage')).toBe(true);
    expect(can('trainee', 'media.upload')).toBe(true);
    expect(can('trainee', 'media.write')).toBe(false);
    expect(can('trainer', 'media.upload')).toBe(true);
    expect(can('editor', 'media.upload')).toBe(true);
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
