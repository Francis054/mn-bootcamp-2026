import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorState } from './feedback';

interface BoundaryState {
  error: Error | null;
}

/** Catches a render crash so one page cannot leave the document blank. */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main id="main">
        <section className="section">
          <div className="container">
            <ErrorState
              title="This page hit a problem"
              text="The rest of the site is still available. Reload, or go back to the homepage."
              onRetry={() => window.location.reload()}
            />
            <p style={{ textAlign: 'center' }}><a href="/">Back to the homepage</a></p>
          </div>
        </section>
      </main>
    );
  }
}

export function RoutedBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <RouteErrorBoundary key={pathname}>{children}</RouteErrorBoundary>;
}
