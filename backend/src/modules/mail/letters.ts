import { brandedEmail, type BrandedEmail } from './template.js';

export interface Letter {
  subject: string;
  text: string;
  html: string;
}

function letter(message: BrandedEmail): Letter {
  return { subject: message.subject, text: message.text, html: message.html };
}

export function verificationLetter(link: string): Letter {
  const intro =
    'Confirm your email address for the Maxim Nyansa trainee portal. This link expires in 24 hours and works once.';
  return letter(
    brandedEmail({
      subject: 'Confirm your Maxim Nyansa trainee account',
      preheader: 'Confirm your email for the trainee portal.',
      heading: 'Confirm your email',
      paragraphs: [intro],
      action: { href: link, label: 'Confirm email' },
      closing: 'If you did not ask for this, you can ignore this message.',
    }),
  );
}

export function resetLetter(link: string): Letter {
  const intro = 'Use this link to choose a new password. It expires in 15 minutes and works once.';
  return letter(
    brandedEmail({
      subject: 'Reset your Maxim Nyansa password',
      preheader: 'Choose a new password. This link expires soon.',
      heading: 'Reset your password',
      paragraphs: [intro],
      action: { href: link, label: 'Choose a new password' },
    }),
  );
}

export function inviteLetter(link: string): Letter {
  const intro = 'Choose a password with this link. It expires in 24 hours and works once.';
  return letter(
    brandedEmail({
      subject: 'Invitation to the Maxim Nyansa admin',
      preheader: 'Choose a password to finish the invitation.',
      heading: 'You are invited',
      paragraphs: [intro],
      action: { href: link, label: 'Choose a password' },
    }),
  );
}

export function existingAccountLetter(link: string): Letter {
  const intro =
    'An account with this email already exists. You can sign in, or ask for a new password from this page.';
  return letter(
    brandedEmail({
      subject: 'You already have a Maxim Nyansa account',
      preheader: 'This email is already on the bootcamp site.',
      heading: 'You already have an account',
      paragraphs: [intro],
      action: { href: link, label: 'Reset your password' },
    }),
  );
}

export function enquiryLetter(topic: string, message: string): Letter {
  return letter(
    brandedEmail({
      subject: 'New enquiry',
      preheader: 'A new enquiry was saved on the bootcamp site.',
      heading: 'New enquiry',
      paragraphs: [`Topic: ${topic}`, message],
    }),
  );
}

export function contactRelayLetter(input: {
  traineeName: string;
  senderName: string;
  organisation: string;
  senderEmail: string;
  message: string;
}): Letter {
  const org = input.organisation ? ` from ${input.organisation}` : '';
  return letter(
    brandedEmail({
      subject: 'A message through the bootcamp site',
      preheader: `${input.senderName} sent a message through the public profile.`,
      heading: 'A message for you',
      paragraphs: [
        `${input.senderName}${org} sent a message about ${input.traineeName} through the public profile.`,
        `Their address is ${input.senderEmail}. The profile address was not shown to them.`,
        input.message,
        'Reply to this message to answer them. Do not copy a private address into a public page.',
      ],
    }),
  );
}

export function cvLinkLetter(input: {
  traineeName: string;
  url: string;
  expiresAt: string;
}): Letter {
  return letter(
    brandedEmail({
      subject: 'CV download link',
      preheader: 'A short CV download link from the bootcamp site.',
      heading: 'CV download',
      paragraphs: [
        `${input.traineeName} is sharing a CV through the Maxim Nyansa Bootcamp site.`,
        'The link works for a limited time and then stops.',
        'It does not include the trainee’s email address.',
        `The link stops at ${input.expiresAt}.`,
      ],
      action: { href: input.url, label: 'Download the CV' },
      closing: 'If you did not ask for this, you can ignore this message.',
    }),
  );
}

export function cvNoticeLetter(input: {
  senderName: string;
  organisation: string;
  senderEmail: string;
  message: string;
}): Letter {
  const org = input.organisation ? ` (${input.organisation})` : '';
  return letter(
    brandedEmail({
      subject: 'Someone asked for your CV',
      preheader: 'A CV request arrived through the bootcamp site.',
      heading: 'Someone asked for your CV',
      paragraphs: [
        `${input.senderName}${org} asked for your CV through the bootcamp site.`,
        `Their address is ${input.senderEmail}. This note does not include the download link.`,
        input.message,
        'You can change who can receive your CV from your portal.',
      ],
    }),
  );
}

export function reviewOutcomeLetter(input: {
  item: string;
  title: string;
  approved: boolean;
  reason: string;
  portalUrl: string;
}): Letter {
  const named = input.title.trim() ? ` “${input.title.trim()}”` : '';
  const heading = input.approved
    ? `Your ${input.item} was approved`
    : `Your ${input.item} was not approved`;
  const paragraphs = input.approved
    ? [`Your ${input.item}${named} was approved. It can appear where your consents allow.`]
    : [
        `Your ${input.item}${named} was not approved.`,
        ...(input.reason.trim() ? [`Reason: ${input.reason.trim()}`] : []),
        'You can update it from the trainee portal and send it again.',
      ];
  return letter(
    brandedEmail({
      subject: heading,
      preheader: heading,
      heading,
      paragraphs,
      action: { href: input.portalUrl, label: 'Open the trainee portal' },
      closing: 'If you did not expect this message, you can ignore it.',
    }),
  );
}
