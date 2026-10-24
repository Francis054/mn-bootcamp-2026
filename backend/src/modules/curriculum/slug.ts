export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

const ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

export function isCatalogueId(value: string): boolean {
  return ID_PATTERN.test(value);
}
