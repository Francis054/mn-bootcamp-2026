import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { normalizeWorkPhotos } from '@/domain/publicContract';
import { workPhotoAddress, workPhotoFileError } from '@/domain/workPhoto';
import { setSession } from '@/dev/session';
import { updateState } from '@/dev/store';

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

describe('work photos', () => {
  it('keeps only safe photo addresses', () => {
    const [photo] = normalizeWorkPhotos([
      { id: 'ok', alt: 'Hands on a keyboard', src: 'https://res.cloudinary.com/demo/image/upload/v1/mn/a.jpg', traineeId: '1' },
      { id: 'bad', alt: 'Hidden', src: 'javascript:alert(1)' },
      { id: 'local', alt: 'Saved here', src: 'memory:abc', traineeId: '1', projectId: '9' },
    ]);
    expect(photo?.id).toBe('ok');
    expect(normalizeWorkPhotos([{ id: 'bad', alt: 'Hidden', src: 'javascript:alert(1)' }])).toEqual([]);
    expect(workPhotoAddress({ id: 'local', src: 'memory:abc' }, 'public')).toBe('/api/v1/public/work-photos/local/file');
    expect(workPhotoAddress({ id: 'ok', src: 'https://res.cloudinary.com/demo/image/upload/v1/mn/a.jpg' }, 'admin')).toContain('https://');
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    expect(workPhotoAddress({ id: 'data', src: dataUrl }, 'public')).toBe(dataUrl);
    expect(normalizeWorkPhotos([{ id: 'data', alt: 'Hands on a keyboard', src: dataUrl, traineeId: '1' }])[0]?.src).toBe(dataUrl);
    expect(normalizeWorkPhotos([{ id: 'html', alt: 'Hidden', src: 'data:text/html,hi' }])).toEqual([]);
    expect(workPhotoFileError(new File(['x'], 'notes.gif', { type: 'image/gif' }))).toMatch(/JPEG, PNG, or WebP/);
    expect(workPhotoFileError(new File(['x'], 'lab-work.webp', { type: 'application/octet-stream' }))).toBeUndefined();
    expect(workPhotoFileError(new File(['x'], 'notes.txt', { type: '' }))).toMatch(/JPEG, PNG, or WebP/);
  });

  it('shows a published photo on the trainee profile and hides a draft', async () => {
    updateState((state) => ({
      ...state,
      workPhotos: [
        {
          id: 'live',
          traineeId: '1',
          projectId: '1',
          src: 'data:image/png;base64,iVBORw0KGgo=',
          width: 1600,
          height: 1066,
          alt: 'Hands on a laptop in the lab',
          caption: 'Working through the lab',
          publicationStatus: 'published',
          listing: 'public',
        },
        {
          id: 'draft',
          traineeId: '1',
          projectId: null,
          src: '/assets/img/hack-coding-team-800.webp',
          width: 1600,
          height: 1066,
          alt: 'A draft that stays private',
          caption: 'Not published',
          publicationStatus: 'draft',
          listing: 'hidden',
        },
      ],
    }));
    renderAt('/trainees/1');
    expect(await screen.findByRole('heading', { name: 'Photos of this trainee at work' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Working through the lab/ })).toBeInTheDocument();
    expect(screen.queryByText('A draft that stays private')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hands on a laptop in the lab' }).getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('lets an administrator publish from the work photos page and keeps editors out', async () => {
    updateState((state) => ({
      ...state,
      workPhotos: [{
        id: 'pending-photo',
        traineeId: '1',
        projectId: null,
        src: '/assets/img/hack-coding-team-800.webp',
        width: 1600,
        height: 1066,
        alt: 'A trainee at the bench',
        caption: 'At the bench',
        publicationStatus: 'draft',
        listing: 'hidden',
      }],
    }));
    setSession({
      mode: 'development',
      user: { id: 'dev-editor', email: 'editor@example.test', displayName: 'Sample Editor', initials: 'SE', hue: 60, role: 'editor' },
      expiresAt: Date.now() + 60_000,
    });
    const editor = renderAt('/admin/work-photos');
    expect(await screen.findByRole('heading', { name: 'Administrators only' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Work photos' })).not.toBeInTheDocument();
    editor.unmount();

    setSession({
      mode: 'development',
      user: { id: 'dev-admin', email: 'administrator@example.test', displayName: 'Sample Administrator', initials: 'SA', hue: 140, role: 'administrator' },
      expiresAt: Date.now() + 60_000,
    });
    renderAt('/admin/work-photos');
    expect(await screen.findByRole('heading', { name: 'Work photos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Work photos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByText('At the bench').closest('article')?.textContent).toContain('Sample Trainee 01');
  });
});
