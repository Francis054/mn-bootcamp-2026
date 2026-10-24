import type { Page, SearchHit } from '@/domain/types';
import { api } from './client';

/** Admin search uses the list endpoints that already accept `q`. There is no search route. */
export async function searchAdmin(q: string): Promise<SearchHit[]> {
  const query = { q, page: 1, pageSize: 5 };
  const [classes, trainees, projects, events] = await Promise.all([
    api<Page<{ id: string; title: string }>>({ method: 'GET', path: '/admin/classes', query }),
    api<Page<{ id: string; displayName: string }>>({ method: 'GET', path: '/admin/trainees', query }),
    api<Page<{ id: string; title: string }>>({ method: 'GET', path: '/admin/projects', query }),
    api<Page<{ id: string; title: string }>>({ method: 'GET', path: '/admin/events', query }),
  ]);
  return [
    ...classes.items.map((item) => ({ type: 'Class', id: item.id, title: item.title, href: `/admin/classes/${item.id}` })),
    ...trainees.items.map((item) => ({ type: 'Trainee', id: item.id, title: item.displayName, href: `/admin/trainees/${item.id}` })),
    ...projects.items.map((item) => ({ type: 'Project', id: item.id, title: item.title, href: `/admin/projects/${item.id}` })),
    ...events.items.map((item) => ({ type: 'Event', id: item.id, title: item.title, href: `/admin/events/${item.id}` })),
  ];
}
