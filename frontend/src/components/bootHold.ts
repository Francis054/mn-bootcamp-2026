import { useEffect, useRef, useSyncExternalStore } from 'react';

export const BOOT_SEEN_KEY = 'mn-boot-seen';
export const BOOT_MIN_FIRST_MS = 2600;
export const BOOT_MIN_REPEAT_MS = 900;
export const BOOT_FAIL_OPEN_MS = 8000;
export const BOOT_EXIT_MS = 340;

export type BootPhase = 'cover' | 'exit' | 'done';

interface Hold {
  id: number;
  pending: boolean;
}

let holds: Hold[] = [];
let sawHold = false;
let phase: BootPhase = 'cover';
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function bootPhase(): BootPhase {
  return phase;
}

export function setBootPhase(next: BootPhase): void {
  if (phase === next) return;
  phase = next;
  emit();
}

/** True while a page or a lazy route is still loading. */
export function bootBlocked(): boolean {
  if (holds.some((hold) => hold.pending)) return true;
  return !sawHold;
}

export function subscribeBoot(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBootCovering(): boolean {
  return useSyncExternalStore(subscribeBoot, bootPhase, () => 'cover') !== 'done';
}

/** Register the caller's pending flag. The boot screen stays up until every hold clears. */
export function useBootHold(pending: boolean): void {
  const id = useRef(0);
  if (id.current === 0) id.current = nextId++;
  useEffect(() => {
    const current = id.current;
    sawHold = true;
    holds = holds.filter((hold) => hold.id !== current).concat({ id: current, pending });
    emit();
    return () => {
      holds = holds.filter((hold) => hold.id !== current);
      emit();
    };
  }, [pending]);
}

export function resetBootForTests(): void {
  holds = [];
  sawHold = false;
  phase = 'cover';
  nextId = 1;
  emit();
}

export function bootMinMs(): number {
  if (import.meta.env.MODE === 'test') return 0;
  try {
    return sessionStorage.getItem(BOOT_SEEN_KEY) === '1' ? BOOT_MIN_REPEAT_MS : BOOT_MIN_FIRST_MS;
  } catch {
    return BOOT_MIN_FIRST_MS;
  }
}

export function markBootSeen(): void {
  try {
    sessionStorage.setItem(BOOT_SEEN_KEY, '1');
  } catch {
    /* private mode */
  }
}
