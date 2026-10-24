export const EVENT_KINDS = ['Milestone', 'Anniversary', 'Partner event'] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(value: string): value is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}

export type EventBody =
  | { kind: 'callout'; tone: 'lime' | 'warn' | 'plain'; title: string; text: string }
  | { kind: 'steps'; title: string; steps: string[]; note?: string }
  | { kind: 'placeholder'; text: string };

const TONES = ['lime', 'warn', 'plain'] as const;

export function eventBodyProblem(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'Write the event body.';
  }
  if (!('kind' in value) || typeof value.kind !== 'string') return 'Choose a body kind.';
  if (value.kind === 'callout') return calloutProblem(value);
  if (value.kind === 'steps') return stepsProblem(value);
  if (value.kind === 'placeholder') return placeholderProblem(value);
  return 'Choose a body kind.';
}

export function placeholderBody(text: string): EventBody {
  return { kind: 'placeholder', text };
}

/** A clean body after `eventBodyProblem` has accepted the value. */
export function readEventBody(value: unknown): EventBody | undefined {
  if (eventBodyProblem(value) !== undefined) return undefined;
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('kind' in value)) return undefined;
  if (value.kind === 'callout' && 'tone' in value && 'title' in value && 'text' in value) {
    if (value.tone === 'lime' || value.tone === 'warn' || value.tone === 'plain') {
      if (typeof value.title === 'string' && typeof value.text === 'string') {
        return {
          kind: 'callout',
          tone: value.tone,
          title: value.title.trim(),
          text: value.text.trim(),
        };
      }
    }
  }
  if (value.kind === 'steps' && 'title' in value && 'steps' in value) {
    return readStepsBody(value);
  }
  if (value.kind === 'placeholder' && 'text' in value && typeof value.text === 'string') {
    return { kind: 'placeholder', text: value.text.trim() };
  }
  return undefined;
}

function readStepsBody(value: object & { title: unknown; steps: unknown }): EventBody | undefined {
  if (typeof value.title !== 'string' || !Array.isArray(value.steps)) return undefined;
  const steps: string[] = [];
  for (const entry of value.steps) {
    const step: unknown = entry;
    if (typeof step !== 'string') return undefined;
    steps.push(step.trim());
  }
  const body: EventBody = { kind: 'steps', title: value.title.trim(), steps };
  if ('note' in value && typeof value.note === 'string' && value.note.trim() !== '') {
    body.note = value.note.trim();
  }
  return body;
}

function calloutProblem(value: object): string | undefined {
  if (!('tone' in value) || typeof value.tone !== 'string' || !isTone(value.tone)) {
    return 'Choose a callout tone.';
  }
  if (!('title' in value) || typeof value.title !== 'string' || value.title.trim().length === 0) {
    return 'Give the callout a title.';
  }
  if (value.title.trim().length > 200) return 'Use at most 200 characters.';
  if (!('text' in value) || typeof value.text !== 'string' || value.text.trim().length === 0) {
    return 'Write the callout text.';
  }
  if (value.text.length > 5000) return 'Use at most 5000 characters.';
  return undefined;
}

function stepsProblem(value: object): string | undefined {
  if (!('title' in value) || typeof value.title !== 'string' || value.title.trim().length === 0) {
    return 'Give the programme a title.';
  }
  if (value.title.trim().length > 200) return 'Use at most 200 characters.';
  if (!('steps' in value) || !Array.isArray(value.steps)) return 'Enter one step per line.';
  if (value.steps.length === 0 || value.steps.length > 20) return 'Enter between 1 and 20 steps.';
  if (value.steps.some((step) => typeof step !== 'string' || step.trim().length === 0)) {
    return 'Enter one step per line.';
  }
  if (value.steps.some((step) => typeof step === 'string' && step.length > 300)) {
    return 'Use at most 300 characters for each step.';
  }
  if ('note' in value && value.note !== undefined) {
    if (typeof value.note !== 'string') return 'Write the programme note as text.';
    if (value.note.length > 500) return 'Use at most 500 characters.';
  }
  return undefined;
}

function placeholderProblem(value: object): string | undefined {
  if (!('text' in value) || typeof value.text !== 'string' || value.text.trim().length === 0) {
    return 'Write the event body.';
  }
  if (value.text.length > 5000) return 'Use at most 5000 characters.';
  return undefined;
}

function isTone(value: string): value is (typeof TONES)[number] {
  return (TONES as readonly string[]).includes(value);
}
