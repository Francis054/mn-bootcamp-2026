# Email for the trainee portal

Verification and password messages are sent with MailerSend when `MAILERSEND_API_TOKEN` and `EMAIL_FROM` are both set. Each message has a plain-text part and an HTML part. The link is in both.

`EMAIL_FROM` is either a mailbox, or a sender name and a mailbox, for example `Bootcamp <hello@your-trial-domain>`. The mailbox must be on a MailerSend trial domain or on a domain MailerSend has verified. Do not commit the token or the from address.

Mail is configured, and mail is sent, only when both values are set. Set both, or leave both blank. In production, if both are blank, the process still boots and reports that nothing was sent. If only one is set, or `EMAIL_FROM` is not a mailbox, the process refuses to start. The error names the variable and does not repeat the value. A trial domain lets this API send without owning the `onrender.com` hostname. These settings belong on the Render API service, never on the static site.

Nothing in this file sends mail or deploys the site. The steps below apply only after this change is reviewed, merged, and the API service is deployed.

## Set up a trial domain

1. Sign in to MailerSend and open Domains. The dashboard shows a trial (test) domain. You do not add DNS for that domain.
2. Choose a from address on that domain, such as `hello@` followed by the domain MailerSend shows. It does not have to be a real inbox. Put that address in `EMAIL_FROM`, with a name if you want one: `Maxim Nyansa <hello@your-trial-domain>`.
3. Open Developer tools, then API tokens. Create a token that can send email. Full access works. Custom access also works when Email is set to Full access. Copy the token once. That value is `MAILERSEND_API_TOKEN`. Leave it out of git and out of chat.
4. On Render, open the API web service (the Node service), then Environment. Add `MAILERSEND_API_TOKEN` and `EMAIL_FROM` there. Do not add them to the static site. A `VITE_` name would copy them into the public JavaScript.
5. Set both, or leave both blank. If only one is filled in, the API will not start. Save. Render deploys the API service after you save. Do that only after this pull request has been reviewed and merged.
6. If `RESEND_API_KEY` is still listed on that API service after the deploy, delete it. The API does not read it.

Official steps for the token and the first test send: https://www.mailersend.com/help/getting-started

## What the API does when a send fails

Every message is written to `email_outbox` first, then sent with one HTTPS POST to `https://api.mailersend.com/v1/email`. The row stores the address, subject, plain text, and HTML needed to try again. It does not store the API token. A failure is logged with the kind and the attempt count. The log does not include the mailbox, the API token, or the reset or verification link. The caller still gets `{ delivered: false }`.

The same process retries a failed row. The waits are 1 minute, 5 minutes, 15 minutes, and 60 minutes, and then it stops after 5 attempts. A free Render web service has no separate worker, so the retry timer runs inside the API process. An administrator can also press Resend on Failed emails. That resets the attempt count and tries the stored message again. There is no job that deletes old messages.

Public signup, resend, and password-reset replies stay the same whether or not a message was accepted, so the form cannot be used to list cohort emails. Signup and approval do not queue a confirmation email. A mail failure does not block registration, approval, or sign-in. Password reset, review outcomes, and the other messages are unchanged. An administrator resending mail for an active trainee account gets `delivered: false` and a sentence that says the email was not sent. The trainee can still sign in after approval.

Each message uses one green and white HTML shell and a plain-text copy of the same words. That covers signup confirmation, password reset, review outcomes, the employer contact relay, CV links, and the other messages this API sends.

Employer contact and CV requests use the same rule. The public response says the note was saved. `delivered` is true only when MailerSend accepted the message. If `MAILERSEND_API_TOKEN` or `EMAIL_FROM` is missing, the contact or CV request is still saved and the email is queued as not sent. Staff can read those rows in the admin area and resend from Failed emails after mail is configured. The public site does not link there. A contact message is sent to the trainee with Reply-To set to the sender, so a reply does not require the site to reveal the trainee's address. A CV request emails the sender a short download link. The trainee's address is not in that message.

Development and the test suite use the in-memory provider. Nothing is sent to MailerSend. `DEV_MAIL_LOG=true` records that a development message was accepted. It is refused when `NODE_ENV=production`.

## Limits

Checked on 5 November 2026. These are the published limits. They are not a promise that a trial domain can mail the whole cohort, and they are not a promise of unrestricted free mail.

Mail to people beyond a small test is delivered only after the MailerSend account is approved and the message is inside the current domain and account limits.

- The getting-started guide says the test domain can send up to 100 emails to 2 unique recipients. It says that limit is the same in Sandbox mode and on the Professional trial. Source: https://www.mailersend.com/help/getting-started
- Sandbox mode (the account you get if you skip the 14-day Professional trial) includes 100 emails a month and 100 API requests a day. Until the account is approved, those emails can go to 2 recipients. After approval, that guide says the same 100 monthly emails can go to any recipient. Approval lifts the recipient cap. It does not remove the monthly cap, and the domain still has its own quota. Source: https://www.mailersend.com/help/sandbox-mode-and-the-professional-trial
- The same page says the 14-day Professional trial includes 500 emails a month and 100 API requests a day. That allowance is not the Sandbox allowance. A trial domain is for testing. It is not the same as production sending on a verified domain.
- The API returns `MS42222` when the trial domain quota is reached, and `MS42225` when a sandbox account hits its unique-recipient limit. Sandbox and Professional trial accounts have a daily limit of 100 API requests. The email endpoint allows 120 requests a minute. Source: https://developers.mailersend.com/general
- An approved Free plan is a different product from the trial domain. That plan's help page describes 500 emails a month and a daily limit of 100 emails. Source: https://www.mailersend.com/help/plans-features-and-limits

A message that hits a limit stays in `email_outbox` and is retried until the attempt limit. An administrator can resend it after that from Failed emails. Ask MailerSend to approve the account (Get approved, in the dashboard) before you expect mail to reach the cohort. Approval can take up to 48 hours. Source: https://www.mailersend.com/help/getting-started

## Your own domain

Add a domain in MailerSend when you are ready to send as your own address. Copy the records from that domain's page. The samples below are what MailerSend documents. They are not a substitute for the DKIM targets on your domain page, because those are unique to the account.

1. **SPF** (one TXT record). MailerSend's example is `v=spf1 include:_spf.mailersend.net ~all`. If the domain already has an SPF record, merge the `include:` into that record. A domain must have only one SPF TXT record. Sources: https://www.mailersend.com/help/how-to-merge-spf-records and https://www.mailersend.com/blog/email-authentication
2. **DKIM** (two CNAME records). MailerSend shows an `ms1` value and an `ms2` value. Add both. Source: https://www.mailersend.com/help/how-to-verify-and-authenticate-a-sending-domain
3. **Return-path** (CNAME). The same help article shows a target of `mailersend.net`. Use the target on your domain page if it differs.
4. **DMARC** (TXT on `_dmarc`). Start with `v=DMARC1; p=none; rua=mailto:mninfo@maximnyansa.com` so you can see reports without rejecting mail. After the domain has been verified and real messages are arriving, tighten `p=` to `quarantine` and then `reject`.

Verification can take a few minutes. MailerSend asks you to wait up to 48 hours before treating a correct-looking domain as stuck. Set `EMAIL_FROM` to an address on that domain only after MailerSend shows it as verified. The from address still has to match a verified domain, including a subdomain of one. Source: https://developers.mailersend.com/api/v1/email

## Signup mode

`TRAINEE_SIGNUP_MODE=roster` is the only supported value. Leave it unset and the process uses `roster`. Every registration waits for an administrator. No confirmation email is sent. Approval opens the trainee login, including an email that is already on the roster, and sets `email_verified_at` when it is empty. The trainee can sign in after that. The public response is the same whether or not the email is on the roster.

Load the cohort into `trainees` (the existing admin trainee form, or a local import) before inviting people to `/signup`. Run `npm run migration:run` against the hosted database before the new process serves traffic. Do not run `npm run seed` on that database.
