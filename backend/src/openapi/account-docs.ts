const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const userRef = { $ref: '#/components/schemas/PublicUser' };
const enquiryRef = { $ref: '#/components/schemas/EnquiryRecord' };

export const accountPaths = {
  '/api/v1/auth/password-reset/request': {
    post: {
      operationId: 'requestPasswordReset',
      summary: 'Ask for a password reset',
      description:
        'The response is the same whether or not the mailbox exists. It does not include a reset link. The request is rate-limited. A session cookie is not required.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ResetRequest' } },
        },
      },
      responses: {
        '200': {
          description: 'The request was accepted. delivered is false in this body.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ResetRequestResult' } },
          },
        },
        '422': { description: 'The address is not a valid email.', content: errorRef },
        '429': { description: 'Too many reset requests.', content: errorRef },
      },
    },
  },
  '/api/v1/auth/password-reset/complete': {
    post: {
      operationId: 'completePasswordReset',
      summary: 'Set a password from a reset or invite link',
      description:
        'The token is single-use and is stored only as a hash. A failed password check does not use the token up. Every session for that account is signed out. passwordStored is true only when a hash was written.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ResetComplete' } },
        },
      },
      responses: {
        '200': {
          description: 'The new password is stored.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ResetCompleteResult' } },
          },
        },
        '422': { description: 'The link or the password was rejected.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/account/password': {
    post: {
      operationId: 'changePassword',
      summary: 'Change the signed-in password',
      description:
        'Requires account.manage, the session cookie, and X-CSRF-Token. The current password is checked again. Other sessions for this account are signed out. This session stays.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/PasswordChange' } },
        },
      },
      responses: {
        '200': {
          description: 'The password was changed.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PasswordChangeResult' } },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'The security token does not match.', content: errorRef },
        '422': {
          description: 'The current password or the new one was rejected.',
          content: errorRef,
        },
      },
    },
  },
  '/api/v1/admin/users': {
    get: {
      operationId: 'listAdminUsers',
      summary: 'List accounts',
      description:
        'Requires users.read, which only an administrator has. The array has no password hash.',
      responses: {
        '200': {
          description: 'Every account.',
          content: { 'application/json': { schema: { type: 'array', items: userRef } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This role cannot list accounts.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/users/{id}': {
    patch: {
      operationId: 'updateUserRole',
      summary: 'Change an account role',
      description:
        'Requires users.manage. The role is one of viewer, editor, or administrator. An administrator cannot remove their own administrator role.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/RolePatch' } } },
      },
      responses: {
        '200': {
          description: 'The updated account.',
          content: { 'application/json': { schema: userRef } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This role cannot change roles.', content: errorRef },
        '404': { description: 'User not found.', content: errorRef },
        '422': { description: 'The role was rejected.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/users/invite': {
    post: {
      operationId: 'inviteUser',
      summary: 'Invite an account',
      description:
        'Requires users.manage. The role is set in this request. The current website form sends only an email, so it is rejected until it also sends a role. delivered is true only when the mail provider accepted the message.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/InviteRequest' } } },
      },
      responses: {
        '200': {
          description: 'The account exists. The message says whether mail was accepted.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/InviteResult' } },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This role cannot invite.', content: errorRef },
        '422': { description: 'The address or the role was rejected.', content: errorRef },
      },
    },
  },
  '/api/v1/public/enquiries': {
    post: {
      operationId: 'createEnquiry',
      summary: 'Send a contact-form enquiry',
      description:
        'Public. No captcha service. A non-empty company field is treated as spam and is not stored. The response message is a status sentence, not the text the person wrote. delivered is true only when a notification was accepted by the mail provider.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/EnquiryRequest' } },
        },
      },
      responses: {
        '200': {
          description: 'Accepted. The body is not echoed.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/EnquiryPublicResult' } },
          },
        },
        '422': { description: 'The form was rejected.', content: errorRef },
        '429': { description: 'Too many enquiries from this address.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/enquiries': {
    get: {
      operationId: 'listAdminEnquiries',
      summary: 'List contact-form enquiries',
      description:
        'Requires users.manage. Newest first. Viewers and editors cannot read the messages.',
      responses: {
        '200': {
          description: 'The inbox.',
          content: { 'application/json': { schema: { type: 'array', items: enquiryRef } } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This role cannot read the inbox.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/enquiries/{id}': {
    patch: {
      operationId: 'updateEnquiry',
      summary: 'Mark an enquiry handled or not',
      description: 'Requires users.manage and X-CSRF-Token.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/EnquiryPatch' } } },
      },
      responses: {
        '200': {
          description: 'The updated enquiry.',
          content: { 'application/json': { schema: enquiryRef } },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This role cannot update the inbox.', content: errorRef },
        '404': { description: 'Enquiry not found.', content: errorRef },
        '422': { description: 'handled must be true or false.', content: errorRef },
      },
    },
    delete: {
      operationId: 'deleteEnquiry',
      summary: 'Delete an enquiry',
      description: 'Requires users.manage and X-CSRF-Token.',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Deleted.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DeletedEnquiry' } },
          },
        },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'This role cannot delete the enquiry.', content: errorRef },
        '404': { description: 'Enquiry not found.', content: errorRef },
      },
    },
  },
};

export const accountSchemas = {
  ResetRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['email'],
    properties: { email: { type: 'string' } },
  },
  ResetRequestResult: {
    type: 'object',
    additionalProperties: false,
    required: ['accepted', 'delivered', 'message'],
    properties: {
      accepted: { type: 'boolean' },
      delivered: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  ResetComplete: {
    type: 'object',
    additionalProperties: false,
    required: ['token', 'password', 'confirm'],
    properties: {
      token: { type: 'string' },
      password: { type: 'string' },
      confirm: { type: 'string' },
    },
  },
  ResetCompleteResult: {
    type: 'object',
    additionalProperties: false,
    required: ['completed', 'passwordStored', 'message'],
    properties: {
      completed: { type: 'boolean' },
      passwordStored: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  PasswordChange: {
    type: 'object',
    additionalProperties: false,
    required: ['current', 'next', 'confirm'],
    properties: {
      current: { type: 'string' },
      next: { type: 'string' },
      confirm: { type: 'string' },
    },
  },
  PasswordChangeResult: {
    type: 'object',
    additionalProperties: false,
    required: ['changed', 'message'],
    properties: {
      changed: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  RolePatch: {
    type: 'object',
    additionalProperties: false,
    required: ['role'],
    properties: { role: { type: 'string', enum: ['viewer', 'editor', 'administrator'] } },
  },
  InviteRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'role'],
    properties: {
      email: { type: 'string' },
      role: { type: 'string', enum: ['viewer', 'editor', 'administrator'] },
    },
  },
  InviteResult: {
    type: 'object',
    additionalProperties: false,
    required: ['delivered', 'message'],
    properties: {
      delivered: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  EnquiryRequest: {
    type: 'object',
    additionalProperties: true,
    required: ['name', 'email', 'topic', 'message', 'consent'],
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      topic: {
        type: 'string',
        enum: [
          'The 2026 bootcamp',
          'Partnering or volunteering',
          'Media and photos',
          'Something else',
        ],
      },
      message: { type: 'string', minLength: 20, maxLength: 5000 },
      consent: { type: 'boolean' },
      company: {
        type: 'string',
        description: 'Leave this empty. A value marks the post as spam and it is not stored.',
      },
    },
  },
  EnquiryPublicResult: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'delivered', 'message'],
    properties: {
      id: { type: 'string' },
      delivered: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
  EnquiryRecord: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'name', 'email', 'topic', 'message', 'createdAt', 'handled', 'notified'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string' },
      topic: { type: 'string' },
      message: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      handled: { type: 'boolean' },
      notified: { type: 'boolean' },
    },
  },
  EnquiryPatch: {
    type: 'object',
    additionalProperties: false,
    required: ['handled'],
    properties: { handled: { type: 'boolean' } },
  },
  DeletedEnquiry: {
    type: 'object',
    additionalProperties: false,
    required: ['deleted', 'id'],
    properties: {
      deleted: { type: 'boolean' },
      id: { type: 'string' },
    },
  },
};
