# Email for the trainee portal

Verification and password messages are sent with Resend when `RESEND_API_KEY` and `EMAIL_FROM` are both set. Each message has a plain-text part and an HTML part. The link is in both.

Until a sending domain is verified, Resend's shared `resend.dev` sender delivers only to the address that owns the Resend account. Trainee mail will not reach the cohort until someone with DNS access for a foundation domain adds the records below and Resend shows the domain as verified.

`EMAIL_FROM` must be an address on that verified domain, for example `Bootcamp <bootcamp@maximnyansa.com>`. Do not commit the API key or the from address.

## What the API does when a send fails

Every message is written to `email_outbox` first, then sent with Resend. The row stores the address, subject, plain text, and HTML needed to try again. It does not store the API key. A failure is logged with the kind and the attempt count. The log does not include the mailbox, the API key, or the token. The caller still gets `{ delivered: false }`.

The same process retries a failed row. The waits are 1 minute, 5 minutes, 15 minutes, and 60 minutes, and then it stops after 5 attempts. A free Render web service has no separate worker, so the retry timer runs inside the API process. An administrator can also press Resend on Failed emails. That resets the attempt count. There is no job that deletes old messages.

Public signup, resend, and password-reset replies stay the same whether or not a message was accepted, so the form cannot be used to list cohort emails. The verification page always offers another link. An administrator approving a signup, or resending an invite, gets `delivered: false` and a sentence that says the account exists and the email was not sent.

Each message uses one green and white HTML shell and a plain-text copy of the same words. That covers signup confirmation, password reset, review outcomes, the employer contact relay, CV links, and the other messages this API sends.

Employer contact and CV requests use the same rule. The public response says the note was saved. `delivered` is true only when Resend accepted the message. If `RESEND_API_KEY` or `EMAIL_FROM` is missing, the contact or CV request is still saved and the email is queued as not sent. Staff can read those rows in the admin area and resend from Failed emails after mail is configured. The public site does not link there. A contact message is sent to the trainee with Reply-To set to the sender, so a reply does not require the site to reveal the trainee's address. A CV request emails the sender a short download link. The trainee's address is not in that message.

Development and the test suite use the in-memory provider. Nothing is sent to Resend. `DEV_MAIL_LOG=true` records that a development message was accepted. It is refused when `NODE_ENV=production`.

## DNS records

Add these on the domain (or a subdomain such as `mail.maximnyansa.com`) that will send. Resend's domain page shows the exact host names and values for the account. Copy those values. The names below are the records to expect. They are not a substitute for the values Resend generates, because the DKIM key is unique to the account.

1. **SPF** (TXT on the sending domain). Authorises Resend to send for that domain. Resend's current value is a TXT record whose content is `v=spf1 include:amazonses.com ~all`, or the SPF string shown in the dashboard if it differs. If the domain already has an SPF record, add the `include:` to that record. A domain must have only one SPF TXT record.
2. **DKIM** (one or more CNAME or TXT records). Resend shows the host (often something like `resend._domainkey`) and the target. Add each row exactly. This is the signature that lets receivers trust the message.
3. **Return-path / MX** if the dashboard lists one. Some setups ask for an MX record so bounces go back to Resend. Add it when it is shown.
4. **DMARC** (TXT on `_dmarc`). Start with `v=DMARC1; p=none; rua=mailto:mninfo@maximnyansa.com` so you can see reports without rejecting mail. After the domain has been verified and real messages are arriving, tighten `p=` to `quarantine` and then `reject`.

Verification can take a few minutes or a few hours. In the Resend dashboard, open Domains and wait until the domain is verified before setting `EMAIL_FROM` to an address on it.

The free Resend plan allows 100 emails a day and 3,000 a month, and a small number of domains. A cohort signup plus resends can reach the daily cap. A message that hits the cap stays in `email_outbox` and is retried until the attempt limit. An administrator can resend it after that from Failed emails.

## Signup mode

`TRAINEE_SIGNUP_MODE=roster` is the only supported value. Leave it unset and the process uses `roster`. An email that is already on the `trainees` table can create a login and must confirm it before sign-in. Any other email is stored for an administrator and does not get a login until that request is approved. The public response is the same in both cases.

Load the cohort into `trainees` (the existing admin trainee form, or a local import) before inviting people to `/signup`. Run `npm run migration:run` against the hosted database before the new process serves traffic. Do not run `npm run seed` on that database.
