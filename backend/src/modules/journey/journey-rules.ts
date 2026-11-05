export const MILESTONE_TITLE_MAX = 160;
export const MILESTONE_SUMMARY_MAX = 2000;
export const MAX_MILESTONES = 40;

export const MILESTONE_VISIBILITIES = ['private', 'public'] as const;
export type MilestoneVisibility = (typeof MILESTONE_VISIBILITIES)[number];

export interface MilestoneInput {
  title: string;
  summary: string;
  occurredOn: string;
  visibility: MilestoneVisibility;
}

const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function isMilestoneVisibility(value: string): value is MilestoneVisibility {
  return (MILESTONE_VISIBILITIES as readonly string[]).includes(value);
}

export function readMilestoneWrite(
  body: unknown,
  mode: 'create' | 'patch',
): { value: Partial<MilestoneInput>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const value: Partial<MilestoneInput> = {};
  if (!isRecord(body)) {
    errors.form = 'Check the highlighted fields.';
    return { value, errors };
  }
  if (mode === 'create' || 'title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) errors.title = 'Enter a title.';
    else if (title.length > MILESTONE_TITLE_MAX) errors.title = 'Use at most 160 characters.';
    else value.title = title;
  }
  if (mode === 'create' || 'occurredOn' in body) {
    const occurredOn = typeof body.occurredOn === 'string' ? body.occurredOn.trim() : '';
    const problem = dateProblem(occurredOn);
    if (problem) errors.occurredOn = occurredOn ? problem : 'Pick a date.';
    else value.occurredOn = occurredOn;
  }
  if (mode === 'create' || 'summary' in body) {
    if (body.summary === undefined || body.summary === null || body.summary === '') value.summary = '';
    else if (typeof body.summary !== 'string') errors.summary = 'Enter a short note, or leave it blank.';
    else if (body.summary.trim().length > MILESTONE_SUMMARY_MAX) errors.summary = 'Use at most 2000 characters.';
    else value.summary = body.summary.trim();
  }
  if (mode === 'create' || 'visibility' in body) {
    const visibility = typeof body.visibility === 'string' ? body.visibility : '';
    if (!isMilestoneVisibility(visibility)) errors.visibility = 'Choose private or public.';
    else value.visibility = visibility;
  }
  if (mode === 'patch' && !('title' in body) && !('occurredOn' in body) && !('summary' in body) && !('visibility' in body)) {
    errors.form = 'Change the milestone before you save it.';
  }
  return { value, errors };
}

function dateProblem(value: string): string | undefined {
  if (!value) return 'Pick a date.';
  if (!DATE.test(value)) return 'Use a date as YYYY-MM-DD.';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 'Use a real date.';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Use a real date.';
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
