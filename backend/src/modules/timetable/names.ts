export type TrainerKind = 'person' | 'group';

export interface SplitTrainers {
  names: string[];
  /** Canonical display name after alias and whitespace folding. */
  canonical: string[];
  status: 'assigned' | 'tbc' | 'all' | 'unspecified';
  collapsedWhitespace: boolean;
  usedSlash: boolean;
  aliases: string[];
}

const ALIASES: Record<string, string> = {
  'madam diana': 'Diana van der Stelt',
  'diana van der stelt': 'Diana van der Stelt',
  stanley: 'Stanley K. Dankyira',
  'stanley k dankyira': 'Stanley K. Dankyira',
  'george plange': 'George Edward Plange',
  'george edward plange': 'George Edward Plange',
  'dr antwi bosiako': 'Dr. Antwi Bosiako',
};

const GROUPS = new Set(['maxim nyansa team']);

/** Fold case, punctuation and inner space so name variants share one key. */
export function trainerKey(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function trainerId(displayName: string): string {
  const slug = trainerKey(displayName).replace(/\s+/g, '-');
  return `tr-${slug}`.slice(0, 64);
}

export function trainerKind(displayName: string): TrainerKind {
  return GROUPS.has(trainerKey(displayName)) ? 'group' : 'person';
}

export function canonicalTrainer(raw: string): { displayName: string; alias: boolean } {
  const folded = raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const alias = ALIASES[trainerKey(folded)];
  if (alias && alias !== folded) return { displayName: alias, alias: true };
  return { displayName: folded, alias: false };
}

/**
 * Split a trainer cell. Slash is a separator only when both sides are names
 * (`Arnold/Ken`). `TBC` and `All` are flags, not people.
 */
export function splitTrainers(raw: string | undefined): SplitTrainers {
  if (!raw || !raw.trim()) {
    return {
      names: [],
      canonical: [],
      status: 'unspecified',
      collapsedWhitespace: false,
      usedSlash: false,
      aliases: [],
    };
  }
  const collapsedWhitespace = /\s{2,}/.test(raw) || /\s,/.test(raw) || /,\S/.test(raw);
  const usedSlash = raw.includes('/');
  const prepared = raw.replace(/\u00a0/g, ' ').replace(/\s*\/\s*/g, ', ');
  const parts = prepared
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);
  const keys = parts.map((part) => trainerKey(part));
  if (parts.length === 1 && (keys[0] === 'tbc' || keys[0] === 'to be confirmed' || keys[0] === 'tba')) {
    return {
      names: [],
      canonical: [],
      status: 'tbc',
      collapsedWhitespace,
      usedSlash,
      aliases: [],
    };
  }
  if (parts.length === 1 && keys[0] === 'all') {
    return {
      names: [],
      canonical: [],
      status: 'all',
      collapsedWhitespace,
      usedSlash,
      aliases: [],
    };
  }
  const canonical: string[] = [];
  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = trainerKey(part);
    if (key === 'tbc' || key === 'to be confirmed' || key === 'tba' || key === 'all') continue;
    const resolved = canonicalTrainer(part);
    const id = trainerKey(resolved.displayName);
    if (seen.has(id)) continue;
    seen.add(id);
    canonical.push(resolved.displayName);
    if (resolved.alias) aliases.push(`${part.trim()} → ${resolved.displayName}`);
  }
  return {
    names: parts,
    canonical,
    status: canonical.length > 0 ? 'assigned' : 'unspecified',
    collapsedWhitespace,
    usedSlash,
    aliases,
  };
}
