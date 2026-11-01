import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, withContentSecurityPolicy } from '@/csp';

describe('production content security policy', () => {
  it('sets default-src and hashes the inline boot snippets from index.html', () => {
    const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const policy = contentSecurityPolicy(html);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain('https://www.youtube-nocookie.com');
    expect(policy).toContain('https://res.cloudinary.com');
    expect(policy).not.toContain('unsafe-inline');
    expect(policy.match(/sha256-/g)?.length).toBe(3);
    const next = withContentSecurityPolicy(html);
    expect(next).toContain(`content="${policy}"`);
    expect(next).not.toContain('content="frame-src ');
  });
});
