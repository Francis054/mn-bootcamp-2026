import type { Role } from './role.js';

/** Fields the browser is allowed to see. The password hash is never one of them. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  hue: number;
  role: Role;
}
