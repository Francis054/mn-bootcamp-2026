import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useParams, Link } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/feedback';
import { App } from '@/App';
import { WorkstationPage } from '@/pages/public/WorkstationPage';

const originalMatch = window.matchMedia.bind(window);

afterEach(() => {
  sessionStorage.clear();
  window.matchMedia = originalMatch;
});

function renderStation(path = '/workstation?lesson=1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WorkstationPage />
    </MemoryRouter>,
  );
}

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

describe('learning workstation', () => {
  it('teaches the lesson, runs the simulated checks, and updates the network status', async () => {
    const user = userEvent.setup();
    renderStation();
    expect(screen.getByRole('heading', { name: /discover and secure a training network/i })).toBeInTheDocument();
    expect(screen.getAllByText(/10\.10\.8\.15/).length).toBeGreaterThan(0);
    expect(screen.getByText(/flat diagram, because reduced motion is on/i)).toBeInTheDocument();
    expect(screen.getByText(/not checked yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /mark this explanation as read/i }));

    await user.click(screen.getByRole('tab', { name: 'Practice' }));
    const command = screen.getByRole('textbox', { name: 'Command' });
    await user.type(command, 'nmap -sV 10.10.8.20{Enter}');
    expect(screen.getByText(/21\/tcp open\s+ftp/)).toBeInTheDocument();
    expect(screen.getByText(/10\.10\.8\.20 · answering/i)).toBeInTheDocument();

    await user.type(command, 'ftp 10.10.8.20{Enter}');
    expect(screen.getByText(/anonymous login, exposed/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/which service should not be open/i), 'anonymous ftp');
    await user.click(screen.getByRole('button', { name: 'Record finding' }));
    expect(screen.getByText(/objective complete: name the exposed service/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Defend' }));
    await user.click(screen.getByRole('button', { name: /reviewed the recommended fix/i }));
    expect(screen.getByText(/marked secured in this lesson/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /practice complete/i })).toBeInTheDocument();
  });

  it('rejects a command that is outside the lesson', async () => {
    const user = userEvent.setup();
    renderStation();
    await user.click(screen.getByRole('tab', { name: 'Practice' }));
    await user.type(screen.getByRole('textbox', { name: 'Command' }), 'sudo nmap 10.10.8.20{Enter}');
    expect(screen.getByText(/no administrator path/i)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Command' }), 'ssh{Enter}');
    expect(screen.getByText(/command not found|usage: ssh/i)).toBeInTheDocument();
  });

  it('opens and closes windows, shows hints, and rotates the 3D model when motion is allowed', async () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const user = userEvent.setup();
    renderStation();
    expect(screen.getByTestId('network-3d').style.transform).toContain('rotateY(-32deg)');
    await user.click(screen.getByRole('button', { name: 'Rotate right' }));
    expect(screen.getByTestId('network-3d').style.transform).toContain('rotateY(-8deg)');

    await user.click(screen.getByRole('button', { name: 'Show a hint' }));
    expect(screen.getByText(/start with ip addr/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Practice' }));
    await user.click(screen.getByRole('button', { name: 'Close Terminal' }));
    expect(screen.queryByRole('region', { name: 'Terminal' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Terminal' }));
    expect(screen.getByRole('region', { name: 'Terminal' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Applications' }));
    expect(screen.getByRole('menu', { name: 'Applications' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'Applications' })).not.toBeInTheDocument();
  });

  it('keeps progress when leaving for the lesson and coming back', async () => {
    const user = userEvent.setup();
    function LessonStub() {
      const { id } = useParams();
      return <Link to={`/workstation?lesson=${id ?? ''}`}>Return to the workstation</Link>;
    }
    render(
      <MemoryRouter initialEntries={['/workstation?lesson=1']}>
        <Routes>
          <Route path="/workstation" element={<WorkstationPage />} />
          <Route path="/classes/:id" element={<LessonStub />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /mark this explanation as read/i }));
    expect(screen.getByText(/explanation marked as read/i)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to the lesson' }));
    await user.click(screen.getByRole('link', { name: 'Return to the workstation' }));
    expect(screen.getByText(/explanation marked as read/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1 of 4 objectives/i).length).toBeGreaterThan(0);
  });
});

describe('workstation entry points', () => {
  it('links the week 1 networks lesson and the bootcamp menu to the workstation', async () => {
    const lesson = renderAt('/classes/1');
    expect(await screen.findByRole('link', { name: 'Open the workstation' })).toHaveAttribute('href', '/workstation?lesson=1');
    lesson.unmount();
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /secure the future/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /learning workstation/i }).length).toBeGreaterThanOrEqual(2);
  });

  it('renders the workstation route', async () => {
    renderAt('/workstation');
    expect(await screen.findByRole('heading', { name: /discover and secure a training network/i })).toBeInTheDocument();
  });
});
