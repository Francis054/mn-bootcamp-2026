const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const imageRef = { $ref: '#/components/schemas/SiteImage' };
const publicRef = { $ref: '#/components/schemas/PublicSiteImage' };

export const siteImagePaths = {
  '/api/v1/public/site-images': {
    get: {
      operationId: 'listPublicSiteImages',
      summary: 'Built-in pictures the public site is showing',
      description:
        'Each slot is a fixed placement such as the logo or a homepage hero photo. The list is safe to cache with the other public reads. A slot that has not been stored yet is omitted, and the website keeps its bundled file.',
      responses: {
        '200': {
          description: 'The stored slots, in catalogue order.',
          content: {
            'application/json': { schema: { type: 'array', items: publicRef } },
          },
        },
      },
    },
  },
  '/api/v1/public/site-images/{key}': {
    get: {
      operationId: 'getPublicSiteImage',
      summary: 'One built-in picture',
      responses: {
        '200': {
          description: 'The slot.',
          content: { 'application/json': { schema: publicRef } },
        },
        '404': { description: 'Unknown or not stored.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/site-images': {
    get: {
      operationId: 'listAdminSiteImages',
      summary: 'Every stored image slot',
      description:
        'Requires an administrator. The body includes the original address so the screen can offer a reset. Storage keys are not included.',
      responses: {
        '200': {
          description: 'The slots, in catalogue order.',
          content: {
            'application/json': { schema: { type: 'array', items: imageRef } },
          },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
      },
    },
    post: {
      operationId: 'createSiteImage',
      summary: 'Store a catalogue slot that is missing',
      description:
        'Body `{ "key" }`. The key must be one of the built-in slots. An existing row is rejected. The new row uses the bundled file.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/SiteImageCreate' } },
        },
      },
      responses: {
        '201': {
          description: 'Created from the bundled file.',
          content: { 'application/json': { schema: imageRef } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '422': { description: 'Unknown key, or the slot is already stored.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/site-images/{key}': {
    patch: {
      operationId: 'updateSiteImageAlt',
      summary: 'Change the alt text for one slot',
      description: 'Body `{ "alt" }`. An empty string is allowed for a decorative placement.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/SiteImageAlt' } },
        },
      },
      responses: {
        '200': {
          description: 'Updated.',
          content: { 'application/json': { schema: imageRef } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Unknown or not stored.', content: errorRef },
        '422': {
          description: 'The alt text is not plain text within 300 characters.',
          content: errorRef,
        },
      },
    },
  },
  '/api/v1/admin/site-images/{key}/image': {
    post: {
      operationId: 'replaceSiteImage',
      summary: 'Replace the file for one slot',
      description:
        'multipart/form-data with `file` and `alt`. JPEG, PNG, or WebP, within the upload size limit. The bytes are checked. The file name is ignored. The previous upload is deleted after the new one is saved. The same storage provider as profile photos and the gallery is used.',
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object' } } },
      },
      responses: {
        '200': {
          description: 'The slot now points at the uploaded file.',
          content: { 'application/json': { schema: imageRef } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Unknown or not stored.', content: errorRef },
        '422': { description: 'The file or the alt text was rejected.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/site-images/{key}/reset': {
    post: {
      operationId: 'resetSiteImage',
      summary: 'Put the bundled file back',
      description:
        'Deletes an uploaded file, when there is one, and restores the original address, alt text, and dimensions. A slot that is already on the original file is returned unchanged.',
      responses: {
        '200': {
          description: 'The original picture is in use again.',
          content: { 'application/json': { schema: imageRef } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not an administrator.', content: errorRef },
        '404': { description: 'Unknown or not stored.', content: errorRef },
      },
    },
  },
};

export const siteImageSchemas = {
  PublicSiteImage: {
    type: 'object',
    additionalProperties: false,
    required: [
      'key',
      'label',
      'description',
      'url',
      'alt',
      'width',
      'height',
      'fit',
      'tagline',
      'updatedAt',
    ],
    properties: {
      key: { type: 'string' },
      label: { type: 'string' },
      description: { type: 'string' },
      url: { type: 'string' },
      alt: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      fit: { type: 'string', enum: ['cover', 'contain'] },
      tagline: { type: 'string' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  SiteImage: {
    type: 'object',
    additionalProperties: false,
    required: [
      'key',
      'label',
      'description',
      'url',
      'alt',
      'width',
      'height',
      'fit',
      'tagline',
      'updatedAt',
      'defaultUrl',
      'defaultAlt',
      'usingDefault',
      'updatedBy',
    ],
    properties: {
      key: { type: 'string' },
      label: { type: 'string' },
      description: { type: 'string' },
      url: { type: 'string' },
      alt: { type: 'string' },
      width: { type: 'integer' },
      height: { type: 'integer' },
      fit: { type: 'string', enum: ['cover', 'contain'] },
      tagline: { type: 'string' },
      updatedAt: { type: 'string', format: 'date-time' },
      defaultUrl: { type: 'string' },
      defaultAlt: { type: 'string' },
      usingDefault: { type: 'boolean' },
      updatedBy: { type: 'string', nullable: true },
    },
  },
  SiteImageCreate: {
    type: 'object',
    additionalProperties: false,
    required: ['key'],
    properties: { key: { type: 'string' } },
  },
  SiteImageAlt: {
    type: 'object',
    additionalProperties: false,
    required: ['alt'],
    properties: { alt: { type: 'string' }, tagline: { type: 'string' } },
  },
};
