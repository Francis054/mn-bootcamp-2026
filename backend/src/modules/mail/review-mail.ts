import type { EmailProvider } from './email-provider.js';
import { reviewOutcomeLetter } from './letters.js';

/** Tells one trainee the outcome of a review. A missing address sends nothing. */
export async function deliverReview(
  mail: EmailProvider,
  input: {
    to: string;
    traineeId: string | null;
    item: string;
    title: string;
    approved: boolean;
    reason: string;
    portalUrl: string;
  },
): Promise<boolean> {
  const to = input.to.trim();
  if (!to) return false;
  const letter = reviewOutcomeLetter(input);
  const message: {
    to: string;
    subject: string;
    text: string;
    html: string;
    kind: string;
    traineeId?: string;
  } = {
    to,
    subject: letter.subject,
    text: letter.text,
    html: letter.html,
    kind: 'review',
  };
  if (input.traineeId) message.traineeId = input.traineeId;
  const result = await mail.send(message);
  return result.delivered;
}
