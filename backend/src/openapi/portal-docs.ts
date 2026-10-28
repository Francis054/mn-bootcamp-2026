const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

export const portalPaths = {
  '/api/v1/public/trainee-signup': {
    post: {
      operationId: 'traineeSignup',
      summary: 'Ask for a trainee account',
      description:
        'Roster mode. The response is the same whether or not the email is on the cohort list. A filled company field is ignored. The password is stored only as an Argon2id hash when an account or a pending request is saved. Rate limit: 3 per hour per email and 5 per hour per address.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/TraineeSignupRequest' } },
        },
      },
      responses: {
        '202': {
          description: 'Accepted. The body does not say whether the email is on the roster.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TraineeSignupAccepted' } },
          },
        },
        '422': { description: 'The form failed validation.', content: errorRef },
        '429': { description: 'Too many signup requests.', content: errorRef },
      },
    },
  },
  '/api/v1/public/trainee-signup/verify': {
    post: {
      operationId: 'verifyTraineeEmail',
      summary: 'Confirm a trainee email',
      description:
        'Consumes a single-use verification token sent in the JSON body. Opening the link in a browser does not consume it. Does not start a session.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/VerifyEmailRequest' } },
        },
      },
      responses: {
        '200': {
          description: 'The email is confirmed.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/VerifyEmailResult' } },
          },
        },
        '422': { description: 'The token is missing, used, or expired.', content: errorRef },
      },
    },
  },
  '/api/v1/public/trainee-signup/resend': {
    post: {
      operationId: 'resendTraineeVerification',
      summary: 'Ask for another confirmation email',
      description:
        'The response is the same whether or not the mailbox has an unverified trainee account. Rate limit: 3 per hour per email and 10 per hour per address.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ResendVerificationRequest' } },
        },
      },
      responses: {
        '202': {
          description: 'Accepted.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TraineeSignupAccepted' } },
          },
        },
        '422': { description: 'The address is not a valid email.', content: errorRef },
        '429': { description: 'Too many resend requests.', content: errorRef },
      },
    },
  },
  '/api/v1/portal/me': {
    get: {
      operationId: 'getPortalMe',
      summary: 'The signed-in trainee',
      description:
        'Requires portal.access. The trainee id comes from the session, not from the URL. A staff session is refused.',
      responses: {
        '200': {
          description: 'The trainee account and the linked roster id.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PortalMe' } },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This session cannot open the portal.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/pending-registrations': {
    get: {
      operationId: 'listPendingRegistrations',
      summary: 'Signup requests waiting for an administrator',
      description: 'Requires users.manage. Password hashes are not returned.',
      responses: {
        '200': {
          description: 'Pending rows, oldest first.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/PendingRegistration' },
              },
            },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/pending-registrations/{id}/approve': {
    post: {
      operationId: 'approvePendingRegistration',
      summary: 'Approve a signup that was not on the roster',
      description:
        'Creates a hidden trainee when none exists for that email, links a trainee login, and sends a confirmation email. delivered is false when mail was not accepted. The account still exists.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        '200': {
          description: 'Approved.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApproveRegistrationResult' } },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'Signup request not found.', content: errorRef },
        '422': { description: 'The request cannot be approved.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/pending-registrations/{id}/reject': {
    post: {
      operationId: 'rejectPendingRegistration',
      summary: 'Reject a signup that was not on the roster',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        '200': {
          description: 'Rejected. No login is created.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PendingRegistration' } },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'Signup request not found.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/trainee-accounts': {
    get: {
      operationId: 'listTraineeAccounts',
      summary: 'Trainee logins with verification and suspend status',
      description: 'Requires users.manage.',
      responses: {
        '200': {
          description: 'Trainee accounts.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/TraineeAccount' } },
            },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/trainee-accounts/{id}/disable': {
    post: {
      operationId: 'disableTraineeAccount',
      summary: 'Suspend a trainee login',
      description: 'Deletes that account’s sessions. Later sign-in uses the same message as a wrong password.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        '200': {
          description: 'Suspended.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TraineeAccount' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'Trainee account not found.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/trainee-accounts/{id}/enable': {
    post: {
      operationId: 'enableTraineeAccount',
      summary: 'Restore a suspended trainee login',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        '200': {
          description: 'Restored.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TraineeAccount' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'Trainee account not found.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/trainee-accounts/{id}/resend-invite': {
    post: {
      operationId: 'resendTraineeInvite',
      summary: 'Send the confirmation or existing-account email again',
      description: 'delivered is false when the provider did not accept the message. A suspended account must be enabled first.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        '200': {
          description: 'The send was attempted.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TraineeMailResult' } },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'Trainee account not found.', content: errorRef },
        '422': { description: 'The account is suspended.', content: errorRef },
      },
    },
  },
};

export const portalSchemas = {
  TraineeSignupRequest: {
    type: 'object',
    additionalProperties: true,
    required: ['email', 'password', 'confirm', 'acceptTerms'],
    properties: {
      email: { type: 'string' },
      password: { type: 'string' },
      confirm: { type: 'string' },
      displayName: { type: 'string' },
      acceptTerms: { type: 'boolean' },
      company: { type: 'string', description: 'Honeypot. Leave empty.' },
    },
  },
  TraineeSignupAccepted: {
    type: 'object',
    additionalProperties: false,
    required: ['accepted', 'message'],
    properties: {
      accepted: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  VerifyEmailRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['token'],
    properties: { token: { type: 'string' } },
  },
  VerifyEmailResult: {
    type: 'object',
    additionalProperties: false,
    required: ['verified', 'message'],
    properties: {
      verified: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  ResendVerificationRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['email'],
    properties: { email: { type: 'string' } },
  },
  PortalMe: {
    type: 'object',
    additionalProperties: false,
    required: ['user', 'traineeId'],
    properties: {
      user: { $ref: '#/components/schemas/PublicUser' },
      traineeId: { type: 'string', nullable: true },
    },
  },
  PendingRegistration: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'email', 'displayName', 'status', 'createdAt', 'reviewedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string' },
      displayName: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
      createdAt: { type: 'string', format: 'date-time' },
      reviewedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  ApproveRegistrationResult: {
    type: 'object',
    additionalProperties: false,
    required: ['delivered', 'message', 'userId', 'traineeId'],
    properties: {
      delivered: { type: 'boolean' },
      message: { type: 'string' },
      userId: { type: 'string', format: 'uuid' },
      traineeId: { type: 'string' },
    },
  },
  TraineeAccount: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'email', 'displayName', 'emailVerified', 'traineeId', 'disabled', 'lastLoginAt', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string' },
      displayName: { type: 'string' },
      emailVerified: { type: 'boolean' },
      traineeId: { type: 'string', nullable: true },
      disabled: { type: 'boolean' },
      lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  TraineeMailResult: {
    type: 'object',
    additionalProperties: false,
    required: ['delivered', 'message'],
    properties: {
      delivered: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};
