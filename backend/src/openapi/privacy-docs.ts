const errorRef = { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } };
const authed = {
  '401': { description: 'Sign in to continue.', content: errorRef },
  '403': {
    description: 'Not an administrator, or the security token does not match.',
    content: errorRef,
  },
};

/**
 * Administrator tools for queued mail and one trainee's data.
 * The public site does not link here.
 */
export const privacyPaths = {
  '/api/v1/admin/email-outbox/failed': {
    get: {
      operationId: 'listFailedEmail',
      summary: 'Failed or stuck outbox messages',
      description:
        'Requires an administrator. Lists messages that failed or stayed in sending or queued past the retry window. The body of the message is not in this list.',
      responses: {
        '200': {
          description: 'The failed and stuck rows.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/FailedEmail' } },
            },
          },
        },
        ...authed,
      },
    },
  },
  '/api/v1/admin/email-outbox/{id}/resend': {
    post: {
      operationId: 'resendFailedEmail',
      summary: 'Try a failed message again',
      description:
        'Requires an administrator and X-CSRF-Token. Resets the attempt count and sends the stored message. The audit row stores the outbox id, not the mailbox.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'The send was attempted.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ResendEmailResult' } },
          },
        },
        '404': {
          description: 'That message was not found, or it was already sent.',
          content: errorRef,
        },
        ...authed,
      },
    },
  },
  '/api/v1/admin/trainees/{id}/export': {
    get: {
      operationId: 'exportTraineeData',
      summary: 'Download one trainee’s data',
      description:
        'Requires an administrator. A zip file with trainee.json and, when the CV can be read, cv.pdf. Password hashes and session secrets are omitted. The CV file is included in the zip.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'The zip download.',
          content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } },
        },
        '404': { description: 'Trainee not found.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/admin/trainees/{id}/erase': {
    post: {
      operationId: 'eraseTrainee',
      summary: 'Remove one trainee and their files',
      description:
        'Requires an administrator and X-CSRF-Token. The body confirmation must match the saved display name. Deletes the trainee’s database rows, then reports each external file. A failed file delete stays in the response and can be retried. There is no automatic schedule.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/EraseTraineeRequest' } },
        },
      },
      responses: {
        '200': {
          description: 'Per-item results. The database status and each file are listed.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RemovalReport' } },
          },
        },
        '404': { description: 'Trainee not found.', content: errorRef },
        '422': { description: 'The confirmation does not match.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/admin/trainee-removals': {
    get: {
      operationId: 'listTraineeRemovals',
      summary: 'Removals that still have failed parts',
      description: 'Requires an administrator. Finished removals are not listed.',
      responses: {
        '200': {
          description: 'Open removals.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/RemovalReport' } },
            },
          },
        },
        ...authed,
      },
    },
  },
  '/api/v1/admin/trainee-removals/{id}/retry': {
    post: {
      operationId: 'retryTraineeRemoval',
      summary: 'Retry a removal’s failed parts',
      description:
        'Requires an administrator and X-CSRF-Token. Tries failed files again and finishes the database delete if it is still pending. An audit row is written.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'The latest per-item results.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RemovalReport' } },
          },
        },
        '404': { description: 'That removal was not found.', content: errorRef },
        ...authed,
      },
    },
  },
};

export const privacySchemas = {
  FailedEmail: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'kind',
      'to',
      'subject',
      'status',
      'attempts',
      'maxAttempts',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      id: { type: 'string', format: 'uuid' },
      traineeId: { type: 'string', nullable: true },
      kind: { type: 'string' },
      to: { type: 'string' },
      subject: { type: 'string' },
      status: { type: 'string', enum: ['queued', 'sending', 'sent', 'failed'] },
      attempts: { type: 'integer' },
      maxAttempts: { type: 'integer' },
      lastError: { type: 'string', nullable: true },
      nextAttemptAt: { type: 'string', nullable: true },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
  },
  ResendEmailResult: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'delivered'],
    properties: {
      id: { type: 'string' },
      delivered: { type: 'boolean' },
    },
  },
  EraseTraineeRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['confirmation'],
    properties: {
      confirmation: { type: 'string' },
    },
  },
  RemovalItem: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'kind', 'label', 'status', 'attempts'],
    properties: {
      id: { type: 'string' },
      kind: { type: 'string' },
      label: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'deleted', 'failed'] },
      error: { type: 'string', nullable: true },
      attempts: { type: 'integer' },
    },
  },
  RemovalReport: {
    type: 'object',
    additionalProperties: false,
    required: ['removalId', 'traineeId', 'displayName', 'database', 'items'],
    properties: {
      removalId: { type: 'string' },
      traineeId: { type: 'string' },
      displayName: { type: 'string' },
      database: {
        type: 'object',
        additionalProperties: false,
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'deleted', 'failed'] },
          error: { type: 'string', nullable: true },
        },
      },
      items: { type: 'array', items: { $ref: '#/components/schemas/RemovalItem' } },
    },
  },
};
