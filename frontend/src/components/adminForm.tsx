import { useRef, useState } from 'react';

/**
 * One place for every admin Save and Publish check. It blocks the request,
 * lists the field names, and drops a field's message as soon as that field is valid.
 */
export function useAdminForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const summaryRef = useRef<HTMLDivElement>(null);

  const reveal = (next: Record<string, string>) => {
    const first = Object.keys(next)[0];
    window.setTimeout(() => {
      const node = first ? document.getElementById(first) : null;
      node?.scrollIntoView?.({ block: 'center' });
      node?.focus();
    }, 0);
  };

  const block = (next: Record<string, string>) => {
    setErrors(next);
    if (Object.keys(next).length === 0) return true;
    reveal(next);
    return false;
  };

  const applyServer = (fieldErrors?: Record<string, string>) => {
    if (!fieldErrors || Object.keys(fieldErrors).length === 0) return;
    block(fieldErrors);
  };

  const clearFixed = (id: string, message: string | undefined) => {
    setErrors((current) => {
      if (!current[id]) return current;
      if (message) return current[id] === message ? current : { ...current, [id]: message };
      const rest = { ...current };
      delete rest[id];
      return rest;
    });
  };

  return { errors, summaryRef, block, applyServer, clearFixed, setErrors };
}
