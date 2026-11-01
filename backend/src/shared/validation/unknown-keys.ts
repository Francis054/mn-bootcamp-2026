/** Field names a hand-written parser will accept. Anything else is rejected. */
export function unknownKeyErrors(body: unknown, allowed: readonly string[]): Record<string, string> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return {};
  const problems: Record<string, string> = {};
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) problems[key] = 'This field is not recognised.';
  }
  return problems;
}
