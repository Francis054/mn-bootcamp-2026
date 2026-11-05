/**
 * One HTML shell for every message this API sends.
 * Forest `#0A1F16` on white and white on forest both clear WCAG AA.
 * The button is forest text `#0A1F16` on lime `#88CC00`, which also clears AA.
 * The plain-text part is built from the same words, not from stripping tags.
 */

export interface BrandedAction {
  href: string;
  label: string;
}

export interface BrandedEmailInput {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: readonly string[];
  action?: BrandedAction;
  closing?: string;
}

export interface BrandedEmail {
  subject: string;
  text: string;
  html: string;
}

const FOREST = '#0A1F16';
const INK = '#0F1A14';
const MUTED = '#33403A';
const LIME = '#88CC00';
const PAPER = '#F6F7F2';
const WHITE = '#FFFFFF';

export function brandedEmail(input: BrandedEmailInput): BrandedEmail {
  const action = safeAction(input.action);
  return {
    subject: input.subject,
    text: plainText(input, action),
    html: htmlDocument(input, action),
  };
}

function plainText(input: BrandedEmailInput, action: BrandedAction | null): string {
  const lines = ['Maxim Nyansa Bootcamp', '', input.heading, ''];
  for (const paragraph of input.paragraphs) {
    lines.push(paragraph, '');
  }
  if (action) {
    lines.push(action.label, action.href, '');
  }
  if (input.closing) lines.push(input.closing, '');
  lines.push('This message was sent by the Maxim Nyansa Foundation bootcamp site.');
  return `${lines.join('\n')}\n`;
}

function htmlDocument(input: BrandedEmailInput, action: BrandedAction | null): string {
  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">${escapeHtml(paragraph)}</p>`,
    )
    .join('');
  const button = action
    ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(action.href)}" style="display:inline-block;padding:12px 20px;background:${LIME};color:${FOREST};font-weight:700;font-size:16px;line-height:1.4;text-decoration:none;border-radius:6px;">${escapeHtml(action.label)}</a></p><p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED};">If the button does not open, copy this address into your browser:<br><a href="${escapeHtml(action.href)}" style="color:${FOREST};">${escapeHtml(action.href)}</a></p>`
    : '';
  const closing = input.closing
    ? `<p style="margin:0;font-size:16px;line-height:1.6;color:${INK};">${escapeHtml(input.closing)}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
<div style="display:none;max-height:0;overflow:hidden;color:${PAPER};">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${WHITE};border-collapse:collapse;">
<tr><td style="background:${FOREST};padding:20px 28px;">
<p style="margin:0;font-family:'Noto Sans',Segoe UI,sans-serif;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${WHITE};">Maxim Nyansa</p>
<p style="margin:4px 0 0;font-family:'Noto Sans',Segoe UI,sans-serif;font-size:16px;color:${LIME};">2026 Cybersecurity Bootcamp</p>
</td></tr>
<tr><td style="padding:28px;font-family:'Noto Sans',Segoe UI,sans-serif;">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:${FOREST};">${escapeHtml(input.heading)}</h1>
${paragraphs}${button}${closing}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-family:'Noto Sans',Segoe UI,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};">
This message was sent by the Maxim Nyansa Foundation bootcamp site.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function safeAction(action: BrandedAction | undefined): BrandedAction | null {
  if (!action) return null;
  try {
    const url = new URL(action.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return { href: action.href, label: action.label };
  } catch {
    return null;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
