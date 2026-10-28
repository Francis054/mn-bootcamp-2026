export interface Letter {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function page(intro: string, link: string, action: string): string {
  const safe = escapeHtml(link);
  return [
    `<p>${escapeHtml(intro)}</p>`,
    `<p><a href="${safe}">${escapeHtml(action)}</a></p>`,
    '<p>If that link does not open, copy this address into your browser:</p>',
    `<p>${safe}</p>`,
  ].join('');
}

export function verificationLetter(link: string): Letter {
  const intro =
    'Confirm your email address for the Maxim Nyansa trainee portal. This link expires in 24 hours and works once.';
  return {
    subject: 'Confirm your Maxim Nyansa trainee account',
    text: `${intro}\n\n${link}\n\nIf you did not ask for this, you can ignore this message.\n`,
    html: `${page(intro, link, 'Confirm email')}<p>If you did not ask for this, you can ignore this message.</p>`,
  };
}

export function resetLetter(link: string): Letter {
  const intro = 'Use this link to choose a new password. It expires in 15 minutes and works once.';
  return {
    subject: 'Reset your Maxim Nyansa password',
    text: `${intro}\n\n${link}\n`,
    html: page(intro, link, 'Choose a new password'),
  };
}

export function inviteLetter(link: string): Letter {
  const intro = 'Choose a password with this link. It expires in 24 hours and works once.';
  return {
    subject: 'Invitation to the Maxim Nyansa admin',
    text: `${intro}\n\n${link}\n`,
    html: page(intro, link, 'Choose a password'),
  };
}

export function existingAccountLetter(link: string): Letter {
  const intro =
    'An account with this email already exists. You can sign in, or ask for a new password from this page.';
  return {
    subject: 'You already have a Maxim Nyansa account',
    text: `${intro}\n\n${link}\n`,
    html: page(intro, link, 'Reset your password'),
  };
}
