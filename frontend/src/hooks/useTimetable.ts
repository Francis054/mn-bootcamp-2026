import { api } from '@/api/client';
import type { PublicTimetable } from '@/domain/timetable';
import { useAsync } from './useAsync';

export function useTimetable() {
  return useAsync('public-timetable', () => api<PublicTimetable>({ method: 'GET', path: '/public/timetable' }));
}
