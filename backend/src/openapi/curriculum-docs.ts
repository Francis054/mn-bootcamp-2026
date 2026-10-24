const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const lessonRef = { $ref: '#/components/schemas/Lesson' };
const publicLessonRef = { $ref: '#/components/schemas/PublicLesson' };

export const curriculumPaths = {
  '/api/v1/public/tracks': {
    get: {
      operationId: 'listPublicTracks',
      summary: 'Published tracks',
      description:
        'Returns tracks whose workflow is published and whose listing is not hidden. The third track name is GRC & Awareness.',
      responses: { '200': { description: 'Track list.' } },
    },
  },
  '/api/v1/public/modules': {
    get: {
      operationId: 'listPublicModules',
      summary: 'Published modules',
      description: 'Same shape as the website ModuleInfo list. Drafts are omitted.',
      responses: { '200': { description: 'Module list.' } },
    },
  },
  '/api/v1/public/phases': {
    get: {
      operationId: 'listPublicPhases',
      summary: 'Published phases',
      description:
        'Each phase includes module display names. A module that is not itself public is left out of that list.',
      responses: { '200': { description: 'Phase list.' } },
    },
  },
  '/api/v1/public/tracks/{id}': {
    get: {
      operationId: 'getPublicTrack',
      summary: 'One published track',
      description: 'Returned only when the track is published and its listing is not hidden.',
      responses: {
        '200': { description: 'The public track.' },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/public/modules/{id}': {
    get: {
      operationId: 'getPublicModule',
      summary: 'One published module',
      description: 'Returned only when the module is published and its listing is not hidden.',
      responses: {
        '200': { description: 'The public module.' },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/public/phases/{id}': {
    get: {
      operationId: 'getPublicPhase',
      summary: 'One published phase',
      description:
        'The id is one digit from 1 to 9. Anything else is 404 before the database is asked.',
      responses: {
        '200': { description: 'The public phase.' },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/public/classes': {
    get: {
      operationId: 'listPublicClasses',
      summary: 'Published classes',
      description:
        'Published lessons whose listing is not hidden. Draft, in-review, and scheduled rows are omitted. internalNotes is omitted. A sample label does not publish a draft.',
      responses: {
        '200': {
          description: 'Public lessons, ordered by week.',
          content: { 'application/json': { schema: { type: 'array', items: publicLessonRef } } },
        },
      },
    },
  },
  '/api/v1/public/classes/{id}': {
    get: {
      operationId: 'getPublicClass',
      summary: 'One published class',
      responses: {
        '200': {
          description: 'The public lesson.',
          content: { 'application/json': { schema: publicLessonRef } },
        },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/classes': {
    get: {
      operationId: 'listAdminClasses',
      summary: 'Class list for an editor',
      description:
        'Requires content.read. Query: q, page, pageSize, sort, dir, filters.moduleId, filters.scheduleStatus, filters.publicationStatus. Week sorts as a number. The default sort is week ascending.',
      responses: { '200': { description: 'A page of lessons, including drafts and notes.' } },
    },
    post: {
      operationId: 'createClass',
      summary: 'Create a class',
      description:
        'Requires content.write. An editor and an administrator both have that permission. Sends the CSRF header when a session cookie is present.',
      responses: {
        '201': { description: 'Created.', content: { 'application/json': { schema: lessonRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Role or CSRF refusal.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/classes/bulk': {
    post: {
      operationId: 'bulkClasses',
      summary: 'Publish or delete selected classes',
      description:
        'Body { ids, action } where action is publish or delete. Missing ids are listed in rejected and are not changed. Publish does not turn a hidden listing into a public one.',
      responses: { '200': { description: '{ ok, action, count, rejected }.' } },
    },
  },
  '/api/v1/admin/classes/{id}': {
    get: { operationId: 'getAdminClass', summary: 'One class, including a draft' },
    patch: { operationId: 'updateClass', summary: 'Edit a class' },
    delete: { operationId: 'deleteClass', summary: 'Delete a class' },
  },
  '/api/v1/admin/classes/{id}/publish': {
    post: {
      operationId: 'publishClass',
      summary: 'Mark a class published',
      description: 'Does not change the listing. A hidden class stays off the public site.',
    },
  },
  '/api/v1/admin/classes/{id}/unpublish': {
    post: {
      operationId: 'unpublishClass',
      summary: 'Return a class to draft',
    },
  },
  '/api/v1/admin/tracks': {
    get: { operationId: 'listAdminTracks', summary: 'All tracks, including drafts' },
    post: { operationId: 'createTrack', summary: 'Create a track' },
  },
  '/api/v1/admin/modules': {
    get: { operationId: 'listAdminModules', summary: 'All modules, including drafts' },
    post: { operationId: 'createModule', summary: 'Create a module' },
  },
  '/api/v1/admin/phases': {
    get: { operationId: 'listAdminPhases', summary: 'All phases, including drafts' },
    post: { operationId: 'createPhase', summary: 'Create a phase' },
  },
  '/api/v1/admin/tracks/{id}': {
    get: { operationId: 'getAdminTrack', summary: 'One track, including a draft' },
    patch: { operationId: 'updateTrack', summary: 'Edit a track' },
    delete: { operationId: 'deleteTrack', summary: 'Delete a track' },
  },
  '/api/v1/admin/tracks/{id}/publish': {
    post: {
      operationId: 'publishTrack',
      summary: 'Mark a track published',
      description:
        'Requires content.write. Does not change the listing. A hidden track stays off the public site.',
    },
  },
  '/api/v1/admin/tracks/{id}/unpublish': {
    post: { operationId: 'unpublishTrack', summary: 'Return a track to draft' },
  },
  '/api/v1/admin/modules/{id}': {
    get: { operationId: 'getAdminModule', summary: 'One module, including a draft' },
    patch: { operationId: 'updateModule', summary: 'Edit a module' },
    delete: { operationId: 'deleteModule', summary: 'Delete a module' },
  },
  '/api/v1/admin/modules/{id}/publish': {
    post: {
      operationId: 'publishModule',
      summary: 'Mark a module published',
      description:
        'Requires content.write. Does not change the listing. A hidden module stays off the public site.',
    },
  },
  '/api/v1/admin/modules/{id}/unpublish': {
    post: { operationId: 'unpublishModule', summary: 'Return a module to draft' },
  },
  '/api/v1/admin/phases/{id}': {
    get: { operationId: 'getAdminPhase', summary: 'One phase, including a draft' },
    patch: { operationId: 'updatePhase', summary: 'Edit a phase' },
    delete: { operationId: 'deletePhase', summary: 'Delete a phase' },
  },
  '/api/v1/admin/phases/{id}/publish': {
    post: {
      operationId: 'publishPhase',
      summary: 'Mark a phase published',
      description:
        'Requires content.write. Does not change the listing. A hidden phase stays off the public site.',
    },
  },
  '/api/v1/admin/phases/{id}/unpublish': {
    post: { operationId: 'unpublishPhase', summary: 'Return a phase to draft' },
  },
};

export const curriculumSchemas = {
  Lesson: {
    type: 'object',
    required: [
      'id',
      'week',
      'moduleId',
      'title',
      'slug',
      'date',
      'format',
      'phase',
      'scheduleStatus',
      'publicationStatus',
      'listing',
      'room',
      'summary',
      'objectives',
      'lab',
      'codeSample',
      'cover',
      'internalNotes',
      'updatedAt',
    ],
    properties: {
      id: { type: 'string' },
      week: { type: 'integer', minimum: 1, maximum: 18 },
      moduleId: { type: 'string' },
      title: { type: 'string' },
      slug: { type: 'string' },
      date: { type: 'string', format: 'date' },
      format: { type: 'string' },
      phase: { type: 'integer', enum: [1, 2, 3] },
      scheduleStatus: { type: 'string', enum: ['done', 'now', 'upcoming'] },
      publicationStatus: {
        type: 'string',
        enum: ['draft', 'in_review', 'scheduled', 'published'],
      },
      listing: { type: 'string', enum: ['hidden', 'sample', 'public'] },
      room: { type: 'string' },
      summary: { type: 'string' },
      objectives: { type: 'array', items: { type: 'string' } },
      lab: { type: 'string' },
      codeSample: { type: 'string' },
      cover: { type: 'string' },
      internalNotes: { type: 'string' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PublicLesson: {
    type: 'object',
    description: 'A lesson without internalNotes.',
  },
};
