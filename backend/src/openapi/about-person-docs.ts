const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const personRef = { $ref: '#/components/schemas/AboutPerson' };
const publicRef = { $ref: '#/components/schemas/PublicAboutPerson' };

const groupSchema = { type: 'string', enum: ['founder', 'team', 'partner'] };

export const aboutPersonPaths = {
  '/api/v1/public/about-people': {
    get: {
      operationId: 'listPublicAboutPeople',
      summary: 'Published founder, team, and partners',
      description:
        'Only rows with published true. Ordered founder, then team, then partners, then display order. The storage key is omitted. An empty description is allowed and is returned as an empty string.',
      responses: {
        '200': {
          description: 'Published people.',
          content: { 'application/json': { schema: { type: 'array', items: publicRef } } },
        },
      },
    },
  },
  '/api/v1/admin/about-people': {
    get: {
      operationId: 'listAdminAboutPeople',
      summary: 'Every about-page person, including unpublished rows',
      description:
        'Requires content.read. A viewer can read this list. The storage key is omitted.',
      responses: {
        '200': {
          description: 'Admin people.',
          content: { 'application/json': { schema: { type: 'array', items: personRef } } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Not staff.', content: errorRef },
      },
    },
    post: {
      operationId: 'createAboutPerson',
      summary: 'Add a person',
      description:
        'Requires content.write. An editor or administrator can create a row. A viewer cannot. Name and group are required. Title and description may be omitted. The person starts unpublished unless published is true. The photo is uploaded separately. The request needs the CSRF token.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/AboutPersonWrite' } },
        },
      },
      responses: {
        '201': { description: 'Created.', content: { 'application/json': { schema: personRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': {
          description: 'No content.write, or the CSRF token does not match.',
          content: errorRef,
        },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/about-people/reorder': {
    post: {
      operationId: 'reorderAboutPeople',
      summary: 'Set the order inside one group',
      description:
        'Requires content.write. ids must list each person in that group once. Display order becomes the list position. The request needs the CSRF token.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/AboutPersonReorder' } },
        },
      },
      responses: {
        '200': {
          description: 'The full admin list.',
          content: { 'application/json': { schema: { type: 'array', items: personRef } } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': {
          description: 'No content.write, or the CSRF token does not match.',
          content: errorRef,
        },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/about-people/{id}': {
    get: {
      operationId: 'getAdminAboutPerson',
      summary: 'One person, including an unpublished row',
      responses: {
        '200': {
          description: 'The person.',
          content: { 'application/json': { schema: personRef } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
    patch: {
      operationId: 'updateAboutPerson',
      summary: 'Edit a person',
      description:
        'Requires content.write. Title and description may be cleared with an empty string. Set published to show or hide the row. The request needs the CSRF token.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/AboutPersonPatch' } },
        },
      },
      responses: {
        '200': { description: 'Updated.', content: { 'application/json': { schema: personRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': {
          description: 'No content.write, or the CSRF token does not match.',
          content: errorRef,
        },
        '404': { description: 'Missing.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
    delete: {
      operationId: 'deleteAboutPerson',
      summary: 'Delete a person and their photo',
      description:
        'Requires content.write. The stored image is removed from Cloudinary, or from memory in tests, before the row is deleted. If the file cannot be removed, the row stays.',
      responses: {
        '200': {
          description: 'Deleted.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['deleted', 'id'],
                properties: { deleted: { type: 'boolean' }, id: { type: 'string' } },
              },
            },
          },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': {
          description: 'No content.write, or the CSRF token does not match.',
          content: errorRef,
        },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/about-people/{id}/photo': {
    post: {
      operationId: 'replaceAboutPersonPhoto',
      summary: 'Upload or replace the photo',
      description:
        'Requires content.write. Multipart field file. JPEG, PNG, or WebP. The bytes are checked. The file name is ignored. The size cap is UPLOAD_MAX_BYTES, the same limit as a profile photo. The previous Cloudinary file is deleted after the new one is saved.',
      responses: {
        '200': { description: 'Saved.', content: { 'application/json': { schema: personRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': {
          description: 'No content.write, or the CSRF token does not match.',
          content: errorRef,
        },
        '404': { description: 'Missing.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
    delete: {
      operationId: 'deleteAboutPersonPhoto',
      summary: 'Remove the photo',
      description: 'Requires content.write. The Cloudinary asset is deleted. The person row stays.',
      responses: {
        '200': {
          description: 'Photo removed.',
          content: { 'application/json': { schema: personRef } },
        },
        '401': { description: 'Sign in.', content: errorRef },
        '403': {
          description: 'No content.write, or the CSRF token does not match.',
          content: errorRef,
        },
        '404': { description: 'Missing.', content: errorRef },
      },
    },
  },
};

export const aboutPersonSchemas = {
  AboutPerson: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'group',
      'name',
      'title',
      'description',
      'photoUrl',
      'width',
      'height',
      'displayOrder',
      'published',
      'updatedAt',
    ],
    properties: {
      id: { type: 'string' },
      group: groupSchema,
      name: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      photoUrl: { type: 'string', nullable: true },
      width: { type: 'integer' },
      height: { type: 'integer' },
      displayOrder: { type: 'integer' },
      published: { type: 'boolean' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PublicAboutPerson: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'group',
      'name',
      'title',
      'description',
      'photoUrl',
      'width',
      'height',
      'displayOrder',
    ],
    properties: {
      id: { type: 'string' },
      group: groupSchema,
      name: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      photoUrl: { type: 'string', nullable: true },
      width: { type: 'integer' },
      height: { type: 'integer' },
      displayOrder: { type: 'integer' },
    },
  },
  AboutPersonWrite: {
    type: 'object',
    additionalProperties: false,
    required: ['group', 'name'],
    properties: {
      group: groupSchema,
      name: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      displayOrder: { type: 'integer' },
      published: { type: 'boolean' },
    },
  },
  AboutPersonPatch: {
    type: 'object',
    additionalProperties: false,
    properties: {
      group: groupSchema,
      name: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      displayOrder: { type: 'integer' },
      published: { type: 'boolean' },
    },
  },
  AboutPersonReorder: {
    type: 'object',
    additionalProperties: false,
    required: ['group', 'ids'],
    properties: {
      group: groupSchema,
      ids: { type: 'array', items: { type: 'string' } },
    },
  },
};
