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
  '/api/v1/portal/profile': {
    get: {
      operationId: 'getOwnTraineeProfile',
      summary: 'The signed-in trainee profile',
      description:
        'Requires portal.access. The trainee id comes from the session. The draft is what the trainee is editing. The live object is the last approved version.',
      responses: {
        '200': {
          description: 'The trainee profile, review status, and consent.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfile' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This session cannot open the portal.', content: errorRef },
        '404': { description: 'The login is not linked to a trainee.', content: errorRef },
      },
    },
    patch: {
      operationId: 'updateOwnTraineeProfile',
      summary: 'Save the signed-in trainee profile',
      description:
        'Requires portal.write. A trainee id in the body is ignored. Public fields stay in draft until an administrator approves them.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfilePatch' } } },
      },
      responses: {
        '200': {
          description: 'The saved draft.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfile' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This session cannot edit the portal.', content: errorRef },
        '422': { description: 'The form failed validation.', content: errorRef },
      },
    },
  },
  '/api/v1/portal/profile/photo': {
    post: {
      operationId: 'uploadOwnTraineePhoto',
      summary: 'Upload a profile photo for review',
      description:
        'Requires portal.write. One JPEG, PNG, or WebP. SVG is refused. EXIF and location data are removed before storage. The photo is not public until it is approved and photo consent is on.',
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } },
      },
      responses: {
        '201': {
          description: 'The photo is stored on the draft.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfile' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This session cannot edit the portal.', content: errorRef },
        '422': { description: 'The file is not an allowed image.', content: errorRef },
      },
    },
    delete: {
      operationId: 'clearOwnTraineePhoto',
      summary: 'Remove the draft profile photo',
      description: 'Requires portal.write. The last approved photo stays public until this removal is approved.',
      responses: {
        '200': {
          description: 'The draft photo is cleared.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfile' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This session cannot edit the portal.', content: errorRef },
      },
    },
  },
  '/api/v1/portal/profile/submit': {
    post: {
      operationId: 'submitOwnTraineeProfile',
      summary: 'Send the profile to the review queue',
      description: 'Requires portal.write and public-profile consent. The last approved version stays public.',
      responses: {
        '200': {
          description: 'The profile is pending review.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfile' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This session cannot edit the portal.', content: errorRef },
        '422': { description: 'Consent is missing, or there is nothing new to submit.', content: errorRef },
      },
    },
  },
  '/api/v1/portal/consents': {
    put: {
      operationId: 'setOwnTraineeConsents',
      summary: 'Change per-item consent',
      description:
        'Requires portal.write. Each change stores the wording version and the time. Withdrawing public-profile consent unpublishes immediately. There is no age check and no retention period.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalConsentPatch' } } },
      },
      responses: {
        '200': {
          description: 'The current consent.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfile' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This session cannot edit the portal.', content: errorRef },
        '422': { description: 'A choice was not yes or no.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/review-queue': {
    get: {
      operationId: 'listProfileReviewQueue',
      summary: 'Profiles waiting for review',
      description: 'Requires content.read. Pending bio, photo, and links. The live object is what is public now.',
      responses: {
        '200': {
          description: 'Pending profiles.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/ReviewQueueItem' } },
            },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/review-queue/{traineeId}': {
    patch: {
      operationId: 'editPendingTraineeProfile',
      summary: 'Edit a profile that is waiting for review',
      description: 'Requires content.write. This changes the pending version, not the public one, until it is approved.',
      parameters: [{ name: 'traineeId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/PortalProfilePatch' } } },
      },
      responses: {
        '200': {
          description: 'The pending profile.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewQueueItem' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'That profile is not waiting for review.', content: errorRef },
        '422': { description: 'The form failed validation.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/review-queue/{traineeId}/approve': {
    post: {
      operationId: 'approveTraineeProfile',
      summary: 'Approve a trainee profile',
      description:
        'Requires content.write. Copies the pending version onto the public profile. The photo is public only when photo consent is on.',
      parameters: [{ name: 'traineeId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'Approved.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewQueueItem' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'That profile is not waiting for review.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/review-queue/{traineeId}/reject': {
    post: {
      operationId: 'rejectTraineeProfile',
      summary: 'Reject a trainee profile',
      description: 'Requires content.write. The reason is shown to the trainee. The last approved version stays public.',
      parameters: [{ name: 'traineeId', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: { reason: { type: 'string', maxLength: 500 } },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Rejected.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReviewQueueItem' } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'You do not have access to that.', content: errorRef },
        '404': { description: 'That profile is not waiting for review.', content: errorRef },
        '422': { description: 'A reason is required.', content: errorRef },
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
  PortalProfile: {
    type: 'object',
    additionalProperties: true,
    required: ['traineeId', 'status', 'draft', 'live', 'consents', 'policyVersion', 'wording'],
    properties: {
      traineeId: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'pending', 'approved', 'rejected'] },
      rejectionReason: { type: 'string' },
      policyVersion: { type: 'string' },
    },
  },
  PortalProfilePatch: {
    type: 'object',
    additionalProperties: false,
    properties: {
      displayName: { type: 'string' },
      headline: { type: 'string' },
      bio: { type: 'string' },
      location: { type: 'string' },
      linkedin: { type: 'string', nullable: true },
      githubUrl: { type: 'string', nullable: true },
      portfolio: { type: 'string', nullable: true },
      photoUrl: { type: 'string', nullable: true },
      photoStorageKey: { type: 'string', nullable: true },
    },
  },
  PortalConsentPatch: {
    type: 'object',
    additionalProperties: false,
    properties: {
      publicProfile: { type: 'boolean' },
      publicPhoto: { type: 'boolean' },
      contactRelay: { type: 'boolean' },
    },
  },
  ReviewQueueItem: {
    type: 'object',
    additionalProperties: true,
    required: ['traineeId', 'status', 'draft', 'live'],
    properties: {
      traineeId: { type: 'string' },
      email: { type: 'string' },
      status: { type: 'string' },
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
