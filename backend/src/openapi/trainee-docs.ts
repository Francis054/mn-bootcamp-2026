const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const traineeRef = { $ref: '#/components/schemas/Trainee' };
const publicTraineeRef = { $ref: '#/components/schemas/PublicTrainee' };

export const traineePaths = {
  '/api/v1/public/trainees': {
    get: {
      operationId: 'listPublicTrainees',
      summary: 'Published trainee profiles that have consent',
      description:
        'A row is returned only when publicationStatus is published, listing is not hidden, and consentReceived is true. The response omits email, linkedin, portfolio, internalNotes, consentReceived, the consent timestamps, and photoStorageKey. photoUrl is included and is null until a photo is saved. Sample seed rows are published but have no consent, so they are not in this list.',
      responses: {
        '200': {
          description: 'Public profiles, ordered by display name.',
          content: {
            'application/json': { schema: { type: 'array', items: publicTraineeRef } },
          },
        },
      },
    },
  },
  '/api/v1/public/trainees/{id}': {
    get: {
      operationId: 'getPublicTrainee',
      summary: 'One public trainee profile',
      responses: {
        '200': {
          description: 'The public profile.',
          content: { 'application/json': { schema: publicTraineeRef } },
        },
        '404': {
          description: 'Missing, unpublished, hidden, or without consent.',
          content: errorRef,
        },
      },
    },
  },
  '/api/v1/admin/trainees': {
    get: {
      operationId: 'listAdminTrainees',
      summary: 'Trainee list for an editor',
      description:
        'Requires content.read. Page { items, page, pageSize, total }. Query: q, page, pageSize, sort, dir, filters.track, filters.focus. Search matches display name, track, and skills. It does not match email. The default sort is displayName. The trainee list has no bulk action.',
      responses: {
        '200': { description: 'A page of trainees, including drafts, email, and notes.' },
      },
    },
    post: {
      operationId: 'createTrainee',
      summary: 'Create a trainee profile',
      description:
        'Requires content.write. An editor and an administrator both have that permission. Sends the CSRF header when a session cookie is present. publicationStatus published is rejected when consentReceived is false. Listing is not rewritten.',
      responses: {
        '201': { description: 'Created.', content: { 'application/json': { schema: traineeRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Role or CSRF refusal.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/trainees/photo': {
    post: {
      operationId: 'uploadTraineePhoto',
      summary: 'Upload a trainee profile photo',
      description:
        'Requires content.write. An editor and an administrator both have that permission. A trainee, trainer, or viewer does not. The body is multipart with one JPEG, PNG, or WebP file. The bytes are sniffed. The file name is not trusted. The cap is UPLOAD_MAX_BYTES. The response is { photoUrl, storageKey }. Saving the trainee profile stores those two values. Development keeps the bytes in memory and returns a same-origin photoUrl. Production uses Cloudinary when it is configured.',
      responses: {
        '201': { description: 'The photo address and the storage key.' },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Role or CSRF refusal.', content: errorRef },
        '422': {
          description: 'The file is missing, too large, or not a JPEG, PNG, or WebP.',
          content: errorRef,
        },
      },
    },
  },
  '/api/v1/public/uploads/{key}': {
    get: {
      operationId: 'getStoredUpload',
      summary: 'A profile photo kept in memory',
      description:
        'Used when Cloudinary is not configured. The key is the id returned with the upload. A missing photo is 404. Cloudinary addresses are loaded from Cloudinary, not from this path.',
      responses: {
        '200': { description: 'The image bytes.' },
        '404': { description: 'No stored photo for that key.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/trainees/{id}': {
    get: {
      operationId: 'getAdminTrainee',
      summary: 'One trainee, including a draft and the private fields',
    },
    patch: {
      operationId: 'updateTrainee',
      summary: 'Edit a trainee',
      description:
        'Omitted fields stay as they are. Setting consentReceived to false withdraws consent and sets publicationStatus to draft in the same write. Asking to publish while consent is false is rejected.',
    },
    delete: { operationId: 'deleteTrainee', summary: 'Delete a trainee' },
  },
  '/api/v1/admin/trainees/{id}/publish': {
    post: {
      operationId: 'publishTrainee',
      summary: 'Mark a trainee published',
      description:
        'Requires content.write and consentReceived. Does not change the listing. A hidden profile stays off the public site.',
    },
  },
  '/api/v1/admin/trainees/{id}/unpublish': {
    post: {
      operationId: 'unpublishTrainee',
      summary: 'Return a trainee to draft',
      description:
        'Does not clear consent. The public site hides the profile until it is published again.',
    },
  },
};

export const traineeSchemas = {
  Trainee: {
    type: 'object',
    description:
      'Admin trainee. consentReceivedAt, consentRecordedBy, and consentWithdrawnAt are bookkeeping. consentRecordedBy is an account id.',
    required: [
      'id',
      'displayName',
      'initials',
      'hue',
      'email',
      'track',
      'focus',
      'skills',
      'bio',
      'quote',
      'linkedin',
      'portfolio',
      'photoUrl',
      'photoStorageKey',
      'consentReceived',
      'listing',
      'publicationStatus',
      'statusLabel',
      'internalNotes',
    ],
    properties: {
      id: { type: 'string' },
      displayName: { type: 'string' },
      initials: { type: 'string' },
      hue: { type: 'integer', minimum: 0, maximum: 359 },
      email: { type: 'string' },
      track: { type: 'string', enum: ['Blue team', 'Red team', 'GRC & Awareness'] },
      focus: { type: 'string' },
      lessonIds: { type: 'array', items: { type: 'string' } },
      skills: { type: 'array', items: { type: 'string' } },
      bio: { type: 'string' },
      quote: { type: 'string' },
      linkedin: { type: 'string', nullable: true },
      portfolio: { type: 'string', nullable: true },
      photoUrl: { type: 'string', nullable: true },
      photoStorageKey: { type: 'string', nullable: true },
      consentReceived: { type: 'boolean' },
      consentReceivedAt: { type: 'string', format: 'date-time', nullable: true },
      consentRecordedBy: { type: 'string', nullable: true },
      consentWithdrawnAt: { type: 'string', format: 'date-time', nullable: true },
      listing: { type: 'string', enum: ['hidden', 'sample', 'public'] },
      publicationStatus: {
        type: 'string',
        enum: ['draft', 'in_review', 'scheduled', 'published'],
      },
      statusLabel: { type: 'string' },
      internalNotes: { type: 'string' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PublicTrainee: {
    type: 'object',
    description:
      'A trainee without email, linkedin, portfolio, internalNotes, photoStorageKey, consentReceived, or consent bookkeeping. photoUrl is null until a photo is saved.',
    required: [
      'id',
      'displayName',
      'initials',
      'hue',
      'track',
      'focus',
      'skills',
      'bio',
      'quote',
      'photoUrl',
      'listing',
      'publicationStatus',
      'statusLabel',
    ],
    properties: {
      id: { type: 'string' },
      displayName: { type: 'string' },
      initials: { type: 'string' },
      hue: { type: 'integer' },
      track: { type: 'string' },
      focus: { type: 'string' },
      skills: { type: 'array', items: { type: 'string' } },
      bio: { type: 'string' },
      quote: { type: 'string' },
      photoUrl: { type: 'string', nullable: true },
      listing: { type: 'string' },
      publicationStatus: { type: 'string' },
      statusLabel: { type: 'string' },
    },
  },
};
