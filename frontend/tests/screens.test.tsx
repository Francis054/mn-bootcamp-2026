import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { App } from '@/App';

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

describe('public routes', () => {
  it('renders the bootcamp overview from the prototype', async () => {
    renderAt('/bootcamp');
    expect(await screen.findByRole('heading', { name: /six disciplines/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /what the cohort learns/i })).toBeInTheDocument();
    expect(screen.getByText('Topics verified')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /practical first/i })).toBeInTheDocument();
    expect(screen.getByText('Does the bootcamp cost anything?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /see the plan week by week/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /what the cohort studies/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /twelve weeks on the timetable/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /foundations & secure systems/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see the timetable/i })).toBeInTheDocument();
  });

  it('renders the home story and verified facts', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    expect(screen.getByText('5 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the 2026 white hat/i })).toBeInTheDocument();
    const hat = screen.getByRole('img', { name: /white fedora with maxim nyansa/i });
    expect(hat).toHaveAttribute('src', '/assets/gear/bootcamp-hat.png');
    expect(hat).toHaveAttribute('width', '1467');
    expect(hat).toHaveAttribute('height', '843');
    expect(hat).toHaveAttribute('loading', 'lazy');
    expect(hat.parentElement?.querySelector('source')?.getAttribute('srcset')).toContain('bootcamp-hat.webp');
  });

  it('does not point visitors at the admin panel', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    const hrefs = [...document.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => href === '/admin' || href.startsWith('/admin/'))).toEqual([]);
    expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin portal|staff login/i })).not.toBeInTheDocument();
    expect(document.getElementById('mobile-menu')?.textContent ?? '').not.toMatch(/admin portal|staff login/i);
  });

  it('filters the class archive', async () => {
    const user = userEvent.setup();
    renderAt('/classes');
    expect(await screen.findByRole('heading', { name: /every lesson/i })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Network' }));
    expect(screen.getByText(/of 12 classes/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /foundations and professional orientation|tcp\/ip networking/i }).length).toBeGreaterThan(0);
  });

  it('keeps about copy in separate columns and headings', async () => {
    renderAt('/about');
    expect(await screen.findByRole('heading', { name: /maximal wisdom/i })).toBeInTheDocument();
    expect(screen.getByText(/to create career perspectives for young people/i)).toBeInTheDocument();
    expect(screen.getByText(/investing in young africans/i)).toBeInTheDocument();
    expect(screen.getByText('Mission').parentElement).toHaveClass('split__a');
    expect(screen.getByText('Vision').parentElement).toHaveClass('split__b');
    expect(screen.getByRole('heading', { name: /eight values, one way of working/i }).closest('.sec-head__title')).toBeTruthy();
    expect(screen.getByText('From maximnyansa.com').closest('.sec-head__aside')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /not bootcamp statistics/i }).closest('.sec-head__title')).toBeTruthy();
    expect(screen.getByText(/permission to display tbc/i).closest('.sec-head__aside')).toBeTruthy();
    expect(screen.getByText('Empowerment').closest('.values')).toBeTruthy();
    expect(screen.getByText(/the 2026 cybersecurity bootcamp begins on 5 oct/i)).toBeInTheDocument();
  });

  it('shows the daily timetable for the current week', async () => {
    renderAt('/schedule');
    expect(await screen.findByRole('heading', { name: /twelve weeks/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /computer systems and secure workstations/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Morning devotion/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/25 Dec 2026/).length).toBeGreaterThan(0);
  });

  it('shows a not-found state for an unknown lesson', async () => {
    renderAt('/classes/missing');
    expect(await screen.findByRole('heading', { name: /not available/i })).toBeInTheDocument();
  });
});

describe('admin gate', () => {
  it('sends an anonymous visitor to the development sign-in', async () => {
    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getAllByText(/not production authentication/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/sign in to open the admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/field needs attention/i)).not.toBeInTheDocument();
  });

  it('does not show an unauthorized notice before the visitor submits', async () => {
    renderAt('/admin/login?reason=unauthorized&next=%2Fadmin');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.queryByText(/sign in to open the admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/field needs attention/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/httponly cookie/i)).not.toBeInTheDocument();
  });

  it('requires the development acknowledgement', async () => {
    const user = userEvent.setup();
    renderAt('/admin/login');
    await user.type(await screen.findByLabelText(/work email/i), 'editor@example.test');
    await user.type(screen.getByLabelText(/^password/i), 'length-ok');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('link', { name: /confirm that you understand/i })).toBeInTheDocument();
  });
});
