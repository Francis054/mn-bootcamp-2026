const ASSET_PATH = /^\/assets\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*$/i;
const LOCAL_UPLOAD =
  /^\/api\/v1\/public\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An address the public site may put in an img tag.
 * Bundled files, memory uploads served by this API, and https only.
 */
export function publicImageUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1000) return undefined;
  if (trimmed.includes('..') || trimmed.includes('\\') || /\s/.test(trimmed)) return undefined;
  if (ASSET_PATH.test(trimmed) || LOCAL_UPLOAD.test(trimmed)) return trimmed;
  if (!/^https:\/\//i.test(trimmed)) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}
