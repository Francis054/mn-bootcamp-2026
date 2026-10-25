import type { PublicProject } from '@/domain/types';

const COVER_KINDS = new Set(['terminal', 'flag', 'scan', 'grid', 'wave', 'shield']);

const STEP_NOTES: Record<string, string> = {
  'Scope and plan': 'Agree what is in scope and how success is measured.',
  'Build and test': 'Work through the lab, documenting each finding.',
  Report: 'Present the findings and recommendations to the group.',
};

export interface ProjectStep {
  title: string;
  note?: string;
  /** A full sentence reads as the step itself, not as a short heading. */
  prose: boolean;
}

export interface ProjectFact {
  label: string;
  value: string;
}

export function coverKind(value: string): string {
  return COVER_KINDS.has(value) ? value : 'terminal';
}

export function isSampleCaseStudy(project: Pick<PublicProject, 'listing' | 'abstract'>): boolean {
  return project.listing !== 'public' || /^placeholder\b/i.test(project.abstract.trim());
}

export function challengeCopy(project: Pick<PublicProject, 'listing' | 'abstract'>): string {
  const text = project.abstract.trim();
  if (text) return text;
  return isSampleCaseStudy(project)
    ? 'Placeholder: a plain-language description of the problem the team set out to solve.'
    : 'A description of this project will be added when the team shares it.';
}

export function reflectionCopy(project: Pick<PublicProject, 'listing' | 'abstract'>): string {
  return isSampleCaseStudy(project)
    ? 'Placeholder for the team’s reflections, written by the trainees once the project is complete.'
    : 'The team’s reflections will appear here once they are ready to share them.';
}

/** Local stock photos are event pictures, not documentation of this project. */
export function imageCaption(image: string, title: string): string {
  const value = image.trim();
  if (/^https:\/\//i.test(value) || value.startsWith('/')) return title || 'Project image';
  return 'Community event photo used as a placeholder — not this project.';
}

export function projectSteps(steps: readonly string[] | undefined): ProjectStep[] {
  return (steps ?? []).flatMap((step) => {
    const title = step.replace(/^\s*\d+[.)]\s*/, '').trim();
    if (!title) return [];
    const note = STEP_NOTES[title];
    const prose = !note && (title.length > 60 || /[.!?]$/.test(title));
    return [{ title, ...(note ? { note } : {}), prose }];
  });
}

function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const end = trimmed.search(/[.!?]/);
  const sentence = end >= 0 ? trimmed.slice(0, end + 1) : trimmed;
  if (sentence.length <= 160) return sentence;
  return `${sentence.slice(0, 157).trimEnd()}…`;
}

export function projectFacts(project: Pick<PublicProject, 'listing' | 'abstract' | 'tools' | 'publicationStatus'>): ProjectFact[] {
  const tools = project.tools.trim();
  if (isSampleCaseStudy(project)) {
    return [
      { label: 'Problem', value: 'Sample' },
      { label: 'Tools', value: tools || 'Lab tools' },
      { label: 'Duration', value: '1–2 weeks' },
      { label: 'Outcome', value: 'Report + demo' },
      { label: 'Status', value: 'Planned' },
    ];
  }
  const facts: ProjectFact[] = [];
  const problem = firstSentence(project.abstract);
  if (problem) facts.push({ label: 'Problem', value: problem });
  if (tools) facts.push({ label: 'Tools', value: tools });
  if (project.publicationStatus === 'published' || project.listing === 'public') {
    facts.push({ label: 'Status', value: 'Published' });
  }
  return facts;
}
