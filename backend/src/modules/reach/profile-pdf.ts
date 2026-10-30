import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PublicTrainee } from '../trainees/records.js';

export interface ProfilePdfInput {
  displayName: string;
  headline: string;
  track: string;
  focus: string;
  location: string;
  bio: string;
  quote: string;
  skills: readonly string[];
  statusLabel: string;
  linkedin?: string;
  githubUrl?: string;
  portfolio?: string;
  profileUrl: string;
  generatedOn: string;
}

/** Public lines only. The type has no email and no CV. */
export function profilePdfLines(input: ProfilePdfInput): string[] {
  const lines = [
    'Maxim Nyansa Bootcamp',
    'Trainee profile',
    input.displayName,
    input.headline,
    `${input.track} · ${input.focus}`,
    input.location,
    input.statusLabel,
    input.bio,
    input.quote ? `“${input.quote}”` : '',
    input.skills.length ? `Skills: ${input.skills.join(', ')}` : '',
    input.linkedin ? `LinkedIn: ${input.linkedin}` : '',
    input.githubUrl ? `GitHub: ${input.githubUrl}` : '',
    input.portfolio ? `Portfolio: ${input.portfolio}` : '',
    input.profileUrl ? `Profile: ${input.profileUrl}` : '',
    `Generated on ${input.generatedOn} from the bootcamp site.`,
    'This file does not include a private address or an uploaded document.',
  ];
  return lines.map(pdfText).filter((line) => line.length > 0);
}

export function profilePdfInput(
  row: PublicTrainee,
  profileUrl: string,
  generatedOn: string,
): ProfilePdfInput {
  return {
    displayName: row.displayName,
    headline: row.headline,
    track: row.track,
    focus: row.focus,
    location: row.location,
    bio: row.bio,
    quote: row.quote,
    skills: row.skills,
    statusLabel: row.statusLabel,
    ...(row.linkedin ? { linkedin: row.linkedin } : {}),
    ...(row.githubUrl ? { githubUrl: row.githubUrl } : {}),
    ...(row.portfolio ? { portfolio: row.portfolio } : {}),
    profileUrl,
    generatedOn,
  };
}

export async function buildProfilePdf(input: ProfilePdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  document.setTitle(`${pdfText(input.displayName)} — trainee profile`);
  document.setAuthor('Maxim Nyansa Bootcamp');
  const lines = profilePdfLines(input);
  let page = document.addPage([595.28, 841.89]);
  let y = 780;
  lines.forEach((line, index) => {
    const size = index === 2 ? 18 : 11;
    const face = index < 3 ? bold : font;
    const wrapped = wrap(line, face, size, 480);
    for (const part of wrapped) {
      if (y < 64) {
        page = document.addPage([595.28, 841.89]);
        y = 780;
      }
      draw(page, part, face, size, y);
      y -= size + 6;
    }
    y -= 4;
  });
  return document.save();
}

function draw(page: PDFPage, text: string, font: PDFFont, size: number, y: number): void {
  page.drawText(text, { x: 56, y, size, font });
}

function wrap(line: string, font: PDFFont, size: number, width: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
      continue;
    }
    if (current) rows.push(current);
    current = word;
  }
  if (current) rows.push(current);
  return rows.length > 0 ? rows : [''];
}

/** Helvetica can only draw a limited set. Accents fold to ASCII. */
export function pdfText(value: string): string {
  const folded = value.normalize('NFKD').replace(/\p{M}/gu, '');
  return folded
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
