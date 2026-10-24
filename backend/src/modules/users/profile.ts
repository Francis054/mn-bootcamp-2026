export function initialsFrom(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  const first = parts[0];
  if (!first) return 'MN';
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (!last) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export function hueFromEmail(email: string): number {
  let hash = 0;
  for (const char of email) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % 360;
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Admin';
  const words = local
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (words.length === 0) return 'Admin';
  return words
    .map((word) => {
      const head = word[0];
      return head ? head.toUpperCase() + word.slice(1) : word;
    })
    .join(' ')
    .slice(0, 120);
}
