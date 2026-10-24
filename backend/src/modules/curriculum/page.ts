export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function pageOf<T>(items: T[], page: number, pageSize: number): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageSize, total };
}
