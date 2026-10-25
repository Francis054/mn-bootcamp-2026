const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const mediaRef = { $ref: '#/components/schemas/MediaItem' };
const publicMediaRef = { $ref: '#/components/schemas/PublicMedia' };

export const mediaPaths = {
  '/api/v1/public/media': {
    get: {
      operationId: 'listPublicMedia',
      summary: 'Published photos with verified consent',
      description:
        'A photo is returned when the workflow is published, the listing is not hidden, and consent is verified. Pending and withdrawn photos stay off this list. The public object omits listing, publicationStatus, consent, and storage. There is no media bulk action.',
      responses: {
        '200': {
          description: 'Public photos.',
          content: {
            'application/json': { schema: { type: 'array', items: publicMediaRef } },
          },
        },
      },
    },
  },
  '/api/v1/public/media/{id}': {
    get: {
      operationId: 'getPublicMedia',
      summary: 'One public photo',
      responses: {
        '200': {
          description: 'The public photo.',
          content: { 'application/json': { schema: publicMediaRef } },
        },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/media': {
    get: {
      operationId: 'listAdminMedia',
      summary: 'Every photo, including drafts',
      description:
        'Requires content.read. The body is an array, not a page. Album filtering stays in the browser.',
      responses: {
        '200': {
          description: 'Admin photos.',
          content: { 'application/json': { schema: { type: 'array', items: mediaRef } } },
        },
        '401': { description: 'Sign in.', content: errorRef },
      },
    },
    post: {
      operationId: 'createMedia',
      summary: 'Add photo metadata or upload an image',
      description:
        'Requires media.upload. A trainee, a trainer, an editor, and an administrator can upload. A JSON body stores metadata only and starts pending, draft, and hidden. A multipart body stores one JPEG, PNG, or WebP. The bytes are sniffed. The file name is not trusted and is not kept. The size cap is UPLOAD_MAX_BYTES, 5 MB unless the host sets another value. Verifying consent is a later edit. This request does not publish.',
      responses: {
        '201': { description: 'Created.', content: { 'application/json': { schema: mediaRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Role or CSRF refusal.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/media/{id}': {
    get: {
      operationId: 'getAdminMedia',
      summary: 'One photo, including a draft and consent bookkeeping',
    },
    patch: {
      operationId: 'updateMedia',
      summary: 'Edit a photo',
      description:
        'Requires media.write. Omitted fields stay as they are. Setting consent to verified records who verified it and does not publish. Publishing in the same request is refused. Publishing is also refused while consent is still pending. Withdrawn consent uses the withdrawal route.',
    },
    delete: {
      operationId: 'deleteMedia',
      summary: 'Delete a photo',
      description:
        'Requires media.write. An uploaded object is removed from storage first. A static seed row deletes metadata only.',
    },
  },
  '/api/v1/admin/media/{id}/publish': {
    post: {
      operationId: 'publishMedia',
      summary: 'Publish a photo that already has verified consent',
      description:
        'Requires media.write. An empty body does not change the listing and is refused while consent is pending or withdrawn. An administrator may send { confirmConsent: true } to verify consent and publish together, and may send listing. Another role that sends confirmConsent is refused.',
    },
  },
  '/api/v1/admin/media/{id}/unpublish': {
    post: {
      operationId: 'unpublishMedia',
      summary: 'Return a photo to draft',
      description: 'Requires media.write.',
    },
  },
  '/api/v1/admin/media/{id}/withdraw-consent': {
    post: {
      operationId: 'withdrawMediaConsent',
      summary: 'Withdraw consent and take the photo off the public site',
      description:
        'Requires media.write. Sets consent to withdrawn, the workflow to draft, and the listing to hidden, and clears src. An uploaded object is deleted from storage. A static seed row has no uploaded object to delete. The audit row stores the action and the photo id.',
    },
  },
};

export const mediaSchemas = {
  PublicMedia: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'file', 'src', 'width', 'height', 'caption', 'alt', 'album'],
    properties: {
      id: { type: 'string' },
      file: { type: 'string' },
      src: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      caption: { type: 'string' },
      alt: { type: 'string' },
      album: { type: 'string', enum: ['anniversary', 'hackathon', 'community'] },
    },
  },
  MediaItem: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'file',
      'src',
      'width',
      'height',
      'caption',
      'alt',
      'album',
      'consent',
      'consentVerifiedAt',
      'consentRecordedBy',
      'consentWithdrawnAt',
      'publicationStatus',
      'listing',
      'storageProvider',
      'updatedAt',
    ],
    properties: {
      id: { type: 'string' },
      file: { type: 'string' },
      src: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      caption: { type: 'string' },
      alt: { type: 'string' },
      album: { type: 'string', enum: ['anniversary', 'hackathon', 'community'] },
      consent: { type: 'string', enum: ['pending', 'verified', 'withdrawn'] },
      consentVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
      consentRecordedBy: { type: 'string', format: 'uuid', nullable: true },
      consentWithdrawnAt: { type: 'string', format: 'date-time', nullable: true },
      publicationStatus: {
        type: 'string',
        enum: ['draft', 'in_review', 'scheduled', 'published'],
      },
      listing: { type: 'string', enum: ['hidden', 'sample', 'public'] },
      storageProvider: { type: 'string', enum: ['static', 'memory', 'cloudinary', 'unconfigured'] },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
};
