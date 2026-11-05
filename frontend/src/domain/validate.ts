export function required(value: string, message = 'This field is required.'): string | null {
  return value.trim() ? null : message;
}

export function minLength(value: string, min: number, message?: string): string | null {
  if (!value.trim()) return null;
  return value.trim().length >= min ? null : message ?? `Use at least ${min} characters.`;
}

export function emailAddress(value: string, message = 'Enter a valid email address, like name@example.com.'): string | null {
  const missing = required(value, 'Enter your email address.');
  if (missing) return missing;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()) ? null : message;
}

export function httpUrl(value: string, optional = true): string | null {
  if (!value.trim()) return optional ? null : 'Enter a full link starting with https://';
  return /^https?:\/\/\S+\.\S+/.test(value.trim()) ? null : 'Enter a full link starting with https://';
}

/** Same rules the API uses when a trainee chooses a password. */
export function newPassword(value: string, email = ''): string | null {
  if (!value) return 'Choose a password.';
  if (value.length < 12) return 'Use at least 12 characters.';
  if (value.length > 200) return 'Use at most 200 characters.';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Use at least one letter and one number.';
  const normalized = email.trim().toLowerCase();
  const local = normalized.split('@')[0] ?? '';
  const candidate = value.toLowerCase();
  if (normalized && (candidate === normalized || (local.length >= 3 && candidate === local))) {
    return 'Do not use the mailbox as the password.';
  }
  return null;
}

export function collect(fields: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => Boolean(entry[1])));
}
