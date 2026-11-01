import { createHash } from 'node:crypto';

/**
 * Policy for the built site. Inline boot snippets are hashed. Vite's dev
 * server is left alone so its client script can run.
 */
export function contentSecurityPolicy(html: string): string {
  const scripts = inlineBlocks(html, 'script')
    .filter((block) => !/\bsrc\s*=/.test(block.open))
    .map((block) => hash(block.body));
  const styles = inlineBlocks(html, 'style').map((block) => hash(block.body));
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `script-src 'self'${scripts.map((value) => ` 'sha256-${value}'`).join('')}`,
    `style-src 'self'${styles.map((value) => ` 'sha256-${value}'`).join('')}`,
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob: https://res.cloudinary.com",
    'frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com',
  ].join('; ');
}

export function withContentSecurityPolicy(html: string): string {
  const policy = contentSecurityPolicy(html);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  if (/<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)) {
    return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, meta);
  }
  return html.replace('<head>', `<head>\n${meta}`);
}

function hash(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('base64');
}

function inlineBlocks(html: string, tag: 'script' | 'style'): Array<{ open: string; body: string }> {
  const pattern = new RegExp(`<(${tag})([^>]*)>([\\s\\S]*?)</${tag}>`, 'g');
  return [...html.matchAll(pattern)].map((match) => ({
    open: `${match[1] ?? ''}${match[2] ?? ''}`,
    body: match[3] ?? '',
  }));
}
