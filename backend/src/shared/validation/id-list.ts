/** Drop blank ids. A non-list is left for the validator to reject. */
export function trimIdList({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return value;
  return value.map((item: string) => item.trim()).filter((item) => item.length > 0);
}

/** Optional lists of related record ids. Blank entries are not an id. */
export function idListMessage(
  value: unknown,
  choose: string,
  tooMany: string,
  max = 40,
): string | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return choose;
  if (value.length > max) return tooMany;
  if (value.some((item: string) => !/^[A-Za-z0-9-]{1,64}$/.test(item))) return choose;
  return undefined;
}
