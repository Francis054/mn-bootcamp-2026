import { api } from '@/api/client';
import type { PublicTimetable } from '@/domain/timetable';
import { useAsync } from './useAsync';

export function useTimetable(options?: { outline?: boolean }) {
  const outline = options?.outline === true;
  return useAsync(outline ? 'public-timetable-outline' : 'public-timetable', () =>
    api<PublicTimetable>({
      method: 'GET',
      path: '/public/timetable',
      ...(outline ? { query: { outline: '1' } } : {}),
    }),
  );
}
