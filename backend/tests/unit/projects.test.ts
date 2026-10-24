import { describe, expect, it } from 'vitest';
import {
  githubRepositoryIsPublic,
  projectUrlProblem,
} from '../../src/modules/projects/project-url.js';
import { buildSampleProjects } from '../../src/modules/projects/sample-projects.js';
import {
  REPOSITORY_LINK_NOTE,
  linksArePublic,
  visibleProjectLinks,
} from '../../src/modules/projects/visibility.js';

describe('project links', () => {
  it('accepts a public https link and rejects private or unsafe ones', () => {
    expect(projectUrlProblem('')).toBeUndefined();
    expect(projectUrlProblem('https://example.test/lab')).toBeUndefined();
    expect(projectUrlProblem('http://example.test/lab')).toBe(
      'Enter a full link starting with https://.',
    );
    expect(projectUrlProblem('javascript:alert(1)')).toBe(
      'Enter a full link starting with https://.',
    );
    expect(projectUrlProblem('data:text/html,hello')).toBe(
      'Enter a full link starting with https://.',
    );
    expect(projectUrlProblem('https://user:s3cret-token@example.test/lab')).toBe(
      'Enter a full link starting with https://.',
    );
    expect(projectUrlProblem('https://127.0.0.1/lab')).toBe('Use a public https address.');
    expect(projectUrlProblem('https://localhost/lab')).toBe('Use a public https address.');
    expect(projectUrlProblem('https://10.1.1.1/lab')).toBe('Use a public https address.');
    expect(projectUrlProblem('https://192.168.0.8/lab')).toBe('Use a public https address.');
    expect(projectUrlProblem('https://lab.internal/work')).toBe('Use a public https address.');
    expect(projectUrlProblem(`https://example.test/${'a'.repeat(500)}`)).toBe(
      'Use at most 500 characters.',
    );
  });

  it('shows links only when the project is public and every linked trainee agreed', () => {
    expect(
      linksArePublic({
        publicationStatus: 'published',
        listing: 'public',
        traineeConsents: [true],
      }),
    ).toBe(true);
    expect(
      linksArePublic({
        publicationStatus: 'published',
        listing: 'sample',
        traineeConsents: [true, false],
      }),
    ).toBe(false);
    expect(
      linksArePublic({
        publicationStatus: 'published',
        listing: 'public',
        traineeConsents: [],
      }),
    ).toBe(false);
    expect(
      linksArePublic({
        publicationStatus: 'draft',
        listing: 'public',
        traineeConsents: [true],
      }),
    ).toBe(false);
    expect(
      linksArePublic({
        publicationStatus: 'published',
        listing: 'hidden',
        traineeConsents: [true],
      }),
    ).toBe(false);
  });

  it('drops a repository link that did not look public and keeps the demo link', () => {
    const hidden = visibleProjectLinks({
      allowed: true,
      repositoryUrl: 'https://github.com/example/private',
      demoUrl: 'https://example.test/demo',
      repositoryIsPublic: false,
    });
    expect(hidden.repositoryUrl).toBeUndefined();
    expect(hidden.demoUrl).toBe('https://example.test/demo');
    expect(hidden.repositoryLinkNote).toBe(REPOSITORY_LINK_NOTE);

    const withdrawn = visibleProjectLinks({
      allowed: false,
      repositoryUrl: 'https://github.com/example/private',
      demoUrl: 'https://example.test/demo',
      repositoryIsPublic: true,
    });
    expect(withdrawn.repositoryUrl).toBeUndefined();
    expect(withdrawn.demoUrl).toBeUndefined();
    expect(withdrawn.repositoryLinkNote).toBeNull();
  });

  it('treats a failed GitHub check as a private repository', async () => {
    const missing = await githubRepositoryIsPublic('https://github.com/example/missing', () =>
      Promise.resolve(new Response(null, { status: 404 })),
    );
    expect(missing).toBe(false);
    const refused = await githubRepositoryIsPublic('https://github.com/example/missing', () =>
      Promise.reject(new Error('network')),
    );
    expect(refused).toBe(false);
    const otherHost = await githubRepositoryIsPublic('https://example.test/demo', () => {
      throw new Error('demo links are not fetched');
    });
    expect(otherHost).toBe(true);
  });

  it('keeps the labelled sample projects unpublished', () => {
    const rows = buildSampleProjects();
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => !row.shareAgreed)).toBe(true);
    expect(rows.every((row) => row.repositoryUrl === '' && row.demoUrl === '')).toBe(true);
    expect(rows.every((row) => row.traineeIds.join() === '1,4')).toBe(true);
    expect(rows.map((row) => row.publicationStatus)).not.toContain('published');
    expect(rows[0]?.title.startsWith('Home network')).toBe(true);
  });
});
