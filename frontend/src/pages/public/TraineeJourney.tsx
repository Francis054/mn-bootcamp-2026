import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { LoadGate } from '@/components/Loader';
import { readJourney, type JourneyBody } from '@/domain/journey';
import { isApiError } from '@/domain/types';

/** Public journey for one published, consented profile. Drafts stay off this section. */
export function TraineeJourney({ traineeId }: { traineeId: string }) {
  const [journey, setJourney] = useState<JourneyBody | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setJourney(null);
    setError('');
    api<unknown>({ method: 'GET', path: `/public/trainees/${traineeId}/journey` })
      .then((body) => {
        if (!cancel) setJourney(readJourney(body, 'public'));
      })
      .catch((err: unknown) => {
        if (!cancel) setError(isApiError(err) ? err.message : 'This journey is not available.');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [traineeId]);
  return (
    <div style={{ marginTop: 24 }}>
      <LoadGate pending={loading} variant="panel" message="Loading the journey…">
        {error ? <p className="muted">{error}</p> : null}
        {journey ? <JourneyTimeline items={journey.items} layout="section" /> : null}
      </LoadGate>
    </div>
  );
}
