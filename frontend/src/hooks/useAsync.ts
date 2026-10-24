import { useEffect, useState } from 'react';
import { ApiError, isApiError } from '@/domain/types';

export function useAsync<T>(key: string, load: () => Promise<T>, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    load()
      .then((value) => {
        if (cancel) return;
        setData(value);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        setError(isApiError(err) ? err : new ApiError('server', 'The request failed.', 500));
        setData(null);
        setLoading(false);
      });
    return () => { cancel = true; };
    // load is read from the latest render; key is the cache identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return { data, error, loading };
}
