import { api } from '@/api/client';
import type { Page } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';

export interface NamedOption {
  id: string;
  name: string;
}

/** Modules from the database. An empty list stays empty so a fixture id is not saved by mistake. */
export function useModules() {
  const record = useAsync('admin-modules', () => api<NamedOption[]>({ method: 'GET', path: '/admin/modules' }));
  return record.data ?? [];
}

export function useAllPages<T extends { id: string }>(path: string) {
  const record = useAsync(`options:${path}`, () => loadPages<T>(path));
  return record.data ?? [];
}

export function useMediaOptions() {
  const record = useAsync('admin-media-options', () => api<Array<{ id: string; alt: string; caption: string }>>({ method: 'GET', path: '/admin/media' }));
  return record.data ?? [];
}

async function loadPages<T>(path: string): Promise<T[]> {
  const first = await api<Page<T>>({ method: 'GET', path, query: { page: 1, pageSize: 100 } });
  const items = [...first.items];
  const size = Math.max(first.pageSize, 1);
  const pages = Math.min(20, Math.ceil(first.total / size));
  for (let page = 2; page <= pages; page += 1) {
    const next = await api<Page<T>>({ method: 'GET', path, query: { page, pageSize: 100 } });
    items.push(...next.items);
  }
  return items;
}

export function withCurrent(options: NamedOption[], current?: string): NamedOption[] {
  if (!current || options.some((option) => option.id === current)) return options;
  return [{ id: current, name: current }, ...options];
}

export function selectedIds(form: HTMLFormElement, name: string): string[] {
  return [...new FormData(form).getAll(name)].map(String).filter(Boolean);
}
