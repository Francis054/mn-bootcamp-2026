const errorRef = { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } };
const missing = { description: 'Not available.', content: errorRef };
const invalid = { description: 'The form failed validation.', content: errorRef };
const limited = { description: 'Too many requests.', content: errorRef };
const authed = {
  '401': { description: 'Sign in to continue.', content: errorRef },
  '403': { description: 'You do not have access to that.', content: errorRef },
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const json = (name: string) => ({
  'application/json': { schema: { $ref: `#/components/schemas/${name}` } },
});

/**
 * Public directory extras, the profile PDF, employer contact, and CV requests.
 * None of these responses include a trainee email address or a CV file address.
 */
export const reachPaths = {
  '/api/v1/public/trainees/{id}/profile.pdf': {
    get: {
      operationId: 'downloadTraineeProfilePdf',
      summary: 'Download a public trainee profile as a PDF',
      description:
        'The file is generated from the public profile. It has no email address and no CV. It is not cached. A hidden, unpublished, or unconsented profile is not available.',
      parameters: [idParam],
      responses: {
        '200': {
          description: 'The profile PDF as a download.',
          content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
        },
        '404': missing,
        '429': limited,
      },
    },
  },
  '/api/v1/public/trainees/{id}/contact': {
    post: {
      operationId: 'contactTrainee',
      summary: 'Send a message to a trainee without seeing their email',
      description:
        'Shown only when the trainee agreed to employer contact and the profile is public. A honeypot field named company is ignored when it is filled. The message is stored and, when email is configured, sent to the trainee with Reply-To set to the sender. The response never includes the trainee email. When email is not configured the message is still saved.',
      parameters: [idParam],
      requestBody: { required: true, content: json('ReachForm') },
      responses: {
        '200': {
          description: 'Saved. delivered is false when email was not sent.',
          content: json('ReachResult'),
        },
        '404': missing,
        '422': invalid,
        '429': limited,
      },
    },
  },
  '/api/v1/public/trainees/{id}/cv-request': {
    post: {
      operationId: 'requestTraineeCv',
      summary: 'Ask for a CV that is shared on request',
      description:
        'Only when the profile is public, the CV is approved, and the trainee chose on request. A short-lived signed link is emailed to the sender when email is configured. The link is served by GET /api/v1/public/cv/{token} and reads the private bucket. The response never includes the trainee email or the link. When email is not configured the request is saved for staff.',
      parameters: [idParam],
      requestBody: { required: true, content: json('ReachForm') },
      responses: {
        '200': {
          description: 'Saved. delivered is false when the link was not emailed.',
          content: json('ReachResult'),
        },
        '404': missing,
        '422': invalid,
        '429': limited,
      },
    },
  },
  '/api/v1/admin/contact-requests': {
    get: {
      operationId: 'listContactRequests',
      summary: 'List employer messages',
      description: 'Requires content.read. The trainee email is not included.',
      responses: {
        '200': {
          description: 'Newest messages first.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/ContactRequest' } },
            },
          },
        },
        ...authed,
      },
    },
  },
  '/api/v1/admin/contact-requests/{id}/block': {
    post: {
      operationId: 'blockContactRequest',
      summary: 'Block the sender of an employer message',
      description: 'Requires content.write. Later messages from that address are not stored.',
      parameters: [idParam],
      responses: {
        '200': { description: 'Blocked.', content: json('ContactRequest') },
        '404': missing,
        ...authed,
      },
    },
  },
  '/api/v1/admin/cv-requests': {
    get: {
      operationId: 'listCvRequests',
      summary: 'List CV requests',
      description: 'Requires content.read. The trainee email is not included.',
      responses: {
        '200': {
          description: 'Newest requests first.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/CvRequest' } },
            },
          },
        },
        ...authed,
      },
    },
  },
  '/api/v1/admin/cv-requests/{id}/send': {
    post: {
      operationId: 'sendCvRequest',
      summary: 'Email the CV download link again',
      description:
        'Requires content.write. Editors and administrators can both do this. When email is not configured the request stays saved and delivered is not implied by a file address. The response has no download link and no trainee email.',
      parameters: [idParam],
      responses: {
        '200': { description: 'The request after the attempt.', content: json('CvRequest') },
        '404': missing,
        ...authed,
      },
    },
  },
};

export const reachSchemas = {
  ReachForm: {
    type: 'object',
    required: ['name', 'email', 'message'],
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      organisation: { type: 'string' },
      message: { type: 'string' },
      company: { type: 'string', description: 'Honeypot. Leave empty.' },
    },
  },
  ReachResult: {
    type: 'object',
    required: ['saved', 'delivered', 'message'],
    properties: {
      saved: { type: 'boolean' },
      delivered: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  ContactRequest: {
    type: 'object',
    required: [
      'id',
      'traineeId',
      'traineeName',
      'fromName',
      'fromEmail',
      'message',
      'status',
      'createdAt',
    ],
    properties: {
      id: { type: 'string' },
      traineeId: { type: 'string' },
      traineeName: { type: 'string' },
      fromName: { type: 'string' },
      fromOrg: { type: 'string' },
      fromEmail: { type: 'string' },
      message: { type: 'string' },
      status: { type: 'string', enum: ['new', 'forwarded', 'blocked', 'failed'] },
      forwardedAt: { type: 'string', nullable: true },
      createdAt: { type: 'string' },
    },
  },
  CvRequest: {
    type: 'object',
    required: [
      'id',
      'traineeId',
      'traineeName',
      'fromName',
      'fromEmail',
      'message',
      'status',
      'createdAt',
    ],
    properties: {
      id: { type: 'string' },
      traineeId: { type: 'string' },
      traineeName: { type: 'string' },
      fromName: { type: 'string' },
      fromOrg: { type: 'string' },
      fromEmail: { type: 'string' },
      message: { type: 'string' },
      status: { type: 'string', enum: ['new', 'sent', 'blocked', 'failed'] },
      sentAt: { type: 'string', nullable: true },
      createdAt: { type: 'string' },
    },
  },
};
