const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const photoRef = { $ref: '#/components/schemas/WorkPhoto' };
const publicPhotoRef = { $ref: '#/components/schemas/PublicWorkPhoto' };

export const workPhotoPaths = {
  '/api/v1/public/work-photos': {
    get: {
      operationId: 'listPublicWorkPhotos',
      summary: 'Published photos of trainees at work',
      description:
        'A photo is returned when the workflow is published and the listing is not hidden. Drafts stay off this list. Optional traineeId and projectId narrow the list. The public object omits workflow, listing, and storage.',
      parameters: [
        { name: 'traineeId', in: 'query', schema: { type: 'string' } },
        { name: 'projectId', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Public work photos.',
          content: {
            'application/json': { schema: { type: 'array', items: publicPhotoRef } },
          },
        },
      },
    },
  },
  '/api/v1/public/work-photos/{id}/file': {
    get: {
      operationId: 'getPublicWorkPhotoFile',
      summary: 'Bytes for one published work photo stored on this server',
      description:
        'Used when the photo was saved in local memory. A Cloudinary photo redirects to its https address. Drafts are not found.',
      responses: {
        '200': {
          description: 'The image bytes.',
          content: { 'image/jpeg': {}, 'image/png': {}, 'image/webp': {} },
        },
        '302': { description: 'Redirect to the stored https address.' },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/work-photos': {
    get: {
      operationId: 'listAdminWorkPhotos',
      summary: 'Every work photo, including drafts',
      description:
        'Requires an administrator. Optional traineeId and projectId narrow the list. The body is an array, not a page.',
      parameters: [
        { name: 'traineeId', in: 'query', schema: { type: 'string' } },
        { name: 'projectId', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Admin work photos.',
          content: { 'application/json': { schema: { type: 'array', items: photoRef } } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
      },
    },
    post: {
      operationId: 'createWorkPhoto',
      summary: 'Upload one photo of a trainee at work',
      description:
        'Requires an administrator. Multipart fields are traineeId, optional projectId, alt, optional caption, and file. The bytes are sniffed. JPEG, PNG, and WebP are accepted. The file name is not trusted. The size cap is UPLOAD_MAX_BYTES, 5 MB unless the host sets another value. The photo starts as a hidden draft and is not public.',
      responses: {
        '201': { description: 'Created.', content: { 'application/json': { schema: photoRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': {
          description: 'Not an administrator, or the CSRF token does not match.',
          content: errorRef,
        },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/work-photos/{id}': {
    get: {
      operationId: 'getAdminWorkPhoto',
      summary: 'One work photo, including a draft',
      responses: {
        '200': { description: 'The photo.', content: { 'application/json': { schema: photoRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
    delete: {
      operationId: 'deleteWorkPhoto',
      summary: 'Remove a work photo',
      description: 'Requires an administrator. The stored image is removed as well.',
      responses: {
        '200': {
          description: 'Deleted.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['deleted', 'id'],
                properties: { deleted: { type: 'boolean' }, id: { type: 'string' } },
              },
            },
          },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/work-photos/{id}/file': {
    get: {
      operationId: 'getAdminWorkPhotoFile',
      summary: 'Bytes for one work photo, including a draft stored on this server',
      responses: {
        '200': {
          description: 'The image bytes.',
          content: { 'image/jpeg': {}, 'image/png': {}, 'image/webp': {} },
        },
        '302': { description: 'Redirect to the stored https address.' },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/work-photos/{id}/publish': {
    post: {
      operationId: 'publishWorkPhoto',
      summary: 'Publish a work photo',
      description:
        'Requires an administrator. Sets the workflow to published. A hidden listing becomes public so the photo can appear on the trainee profile and, when a project was chosen, on that project page.',
      responses: {
        '200': { description: 'Published.', content: { 'application/json': { schema: photoRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/work-photos/{id}/unpublish': {
    post: {
      operationId: 'unpublishWorkPhoto',
      summary: 'Take a work photo off the public site',
      description: 'Requires an administrator. Sets the workflow back to draft.',
      responses: {
        '200': {
          description: 'Unpublished.',
          content: { 'application/json': { schema: photoRef } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
  },
};

export const workPhotoSchemas = {
  WorkPhoto: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'traineeId',
      'projectId',
      'src',
      'width',
      'height',
      'alt',
      'caption',
      'publicationStatus',
      'listing',
      'storageProvider',
      'uploadedBy',
      'updatedAt',
    ],
    properties: {
      id: { type: 'string' },
      traineeId: { type: 'string' },
      projectId: { type: 'string', nullable: true },
      src: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      alt: { type: 'string' },
      caption: { type: 'string' },
      publicationStatus: { type: 'string', enum: ['draft', 'in_review', 'scheduled', 'published'] },
      listing: { type: 'string', enum: ['hidden', 'sample', 'public'] },
      storageProvider: { type: 'string', enum: ['static', 'memory', 'cloudinary', 'unconfigured'] },
      uploadedBy: { type: 'string', nullable: true },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PublicWorkPhoto: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'traineeId', 'projectId', 'src', 'width', 'height', 'alt', 'caption'],
    properties: {
      id: { type: 'string' },
      traineeId: { type: 'string' },
      projectId: { type: 'string', nullable: true },
      src: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      alt: { type: 'string' },
      caption: { type: 'string' },
    },
  },
};
