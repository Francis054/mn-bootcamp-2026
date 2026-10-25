import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { pictureSource } from '@/components/Brand';
import { ToastProvider } from '@/components/feedback';
import { setEnvForTests } from '@/config/runtime';
import { normalizeProjects, publicHttpsUrl } from '@/domain/publicContract';
import { App } from '@/App';
import { projectFacts, projectSteps } from '@/pages/public/projectDetail';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('project case study copy', () => {
  it('keeps the sample study on the prototype facts and step notes', () => {
    const facts = projectFacts({
      listing: 'sample',
      abstract: 'Placeholder: a plain-language description.',
      tools: 'pfSense, Wireshark',
      publicationStatus: 'draft',
    });
    expect(facts.map((fact) => fact.value)).toEqual(['Sample', 'pfSense, Wireshark', '1–2 weeks', 'Report + demo', 'Planned']);
    expect(projectSteps(['Scope and plan', 'Build and test', 'Report'])[0]).toMatchObject({
      title: 'Scope and plan',
      note: 'Agree what is in scope and how success is measured.',
      prose: false,
    });
  });

  it('uses a published write-up as written and drops a missing duration', () => {
    const facts = projectFacts({
      listing: 'public',
      publicationStatus: 'published',
      abstract: 'Design and simulate a secure small office network. Configure routers.',
      tools: 'Cisco Packet Tracer',
    });
    expect(facts.map((fact) => fact.label)).toEqual(['Problem', 'Tools', 'Status']);
    expect(facts[0]?.value).toBe('Design and simulate a secure small office network.');
    expect(projectSteps(['1. Design a small office network topology.'])).toEqual([
      { title: 'Design a small office network topology.', prose: true },
    ]);
    expect(projectSteps(['', '   '])).toEqual([]);
  });

  it('keeps safe https links and drops anything else', () => {
    expect(publicHttpsUrl(' https://github.com/example/lab ')).toBe('https://github.com/example/lab');
    expect(publicHttpsUrl('javascript:alert(1)')).toBeUndefined();
    expect(publicHttpsUrl('https://user:secret@github.com/example/lab')).toBeUndefined();
    expect(publicHttpsUrl('http://example.com/demo')).toBeUndefined();
    const [project] = normalizeProjects([{
      id: 'p1',
      title: 'Lab',
      repositoryUrl: 'javascript:alert(1)',
      demoUrl: 'https://example.com/demo',
    }]);
    expect(project?.repositoryUrl).toBeUndefined();
    expect(project?.demoUrl).toBe('https://example.com/demo');
  });

  it('does not turn a Cloudinary address into a local file name', () => {
    const remote = 'https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg';
    expect(pictureSource(remote)).toEqual({ src: remote });
    expect(pictureSource('electronics-lab')?.src).toBe('/assets/img/electronics-lab-1600.webp');
    expect(pictureSource('not a file')).toBeNull();
  });
});

describe('project page', () => {
  it('renders the sample case study without placeholder step copy', async () => {
    renderAt('/projects/1');
    expect(await screen.findByRole('heading', { name: /home network hardening lab/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The challenge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Approach' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What we learned' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Next/ })).toBeInTheDocument();
    expect(screen.getByText('Scope and plan')).toBeInTheDocument();
    expect(screen.queryByText(/placeholder step/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not this project/i)).toBeInTheDocument();
  });

  it('shows a published project, a trainee link, and only a safe demo link', async () => {
    setEnvForTests({ apiMode: 'live', apiBaseUrl: '', authMode: 'development', sessionTtlMs: 1_800_000 });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/auth/session')) return json({ authenticated: false });
      if (url.includes('/public/home') || url.includes('/public/about')) return json({ error: { code: 'not_found', message: 'Content not found.' } }, 404);
      if (url.includes('/public/projects')) {
        return json([{
          id: 'ce55af49-0517-4d53-9355-5e82d097fe7d',
          title: 'Design and Secure a Small Office Network Using Cisco Packet Tracer',
          type: 'Lab',
          moduleId: 'network',
          cover: 'terminal',
          image: 'https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg',
          abstract: 'Design and simulate a secure small office network in Cisco Packet Tracer. Configure routers.',
          tools: 'Cisco Packet Tracer, Cisco IOS CLI',
          steps: ['1. Design a small office network topology.', '2. Test connectivity with ping.'],
          team: ['Francis Dey'],
          listing: 'public',
          publicationStatus: 'published',
          repositoryUrl: 'javascript:alert(1)',
          demoUrl: 'https://example.com/demo',
        }]);
      }
      if (url.includes('/public/trainees')) {
        return json([{ id: 't1', displayName: 'Francis Dey', initials: 'FD', hue: 140, track: 'Blue team', focus: 'network', listing: 'public', statusLabel: 'In training' }]);
      }
      if (url.includes('/public/')) return json([]);
      return json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
    }));

    renderAt('/projects/ce55af49-0517-4d53-9355-5e82d097fe7d');
    expect(await screen.findByRole('heading', { name: /small office network/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Francis Dey' })).toHaveAttribute('href', '/trainees/t1');
    expect(screen.getByRole('link', { name: 'Demo' })).toHaveAttribute('href', 'https://example.com/demo');
    expect(screen.queryByRole('link', { name: 'Repository' })).not.toBeInTheDocument();
    expect(screen.queryByText(/javascript:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/placeholder step/i)).not.toBeInTheDocument();
    expect(screen.getByText('Design a small office network topology.')).toBeInTheDocument();
    const photo = document.querySelector('.case-photo img');
    expect(photo).toHaveAttribute('src', 'https://res.cloudinary.com/demo/image/upload/v1/mn/photo.jpg');
    expect(photo).not.toHaveAttribute('srcset');
    vi.unstubAllGlobals();
  });

  it('names the team without inventing a profile link', async () => {
    renderAt('/projects/1');
    expect(await screen.findByText(/Sample Trainee 01/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sample Trainee 01' })).toHaveAttribute('href', '/trainees/1');
  });
});
