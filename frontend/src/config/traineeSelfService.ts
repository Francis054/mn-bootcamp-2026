/**
 * Student sign-in, sign-up, and sign-out.
 * Off unless the site is built with VITE_TRAINEE_SELF_SERVICE=on.
 * Administrator and editor sign-in does not use this switch.
 */
let override: boolean | null = null;

export function traineeSelfServiceEnabled(): boolean {
  if (override !== null) return override;
  return import.meta.env.VITE_TRAINEE_SELF_SERVICE === 'on';
}

/** Tests only. Pass null to read the build flag again. */
export function setTraineeSelfServiceForTests(enabled: boolean | null): void {
  override = enabled;
}
