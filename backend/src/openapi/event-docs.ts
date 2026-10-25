const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const eventRef = { $ref: '#/components/schemas/Event' };
const publicEventRef = { $ref: '#/components/schemas/PublicEvent' };

export const eventPaths = {
  '/api/v1/public/events': {
    get: {
      operationId: 'listPublicEvents',
      summary: 'Published events',
      description:
        'A published event is returned when listing is not hidden. A scheduled event stays off this list until its start in Africa/Accra, which is UTC. A date marked to be confirmed does not become public on its own. There is no event bulk action and no calendar file endpoint.',
      responses: {
        '200': {
          description: 'Public events.',
          content: {
            'application/json': { schema: { type: 'array', items: publicEventRef } },
          },
        },
      },
    },
  },
  '/api/v1/public/events/{id}': {
    get: {
      operationId: 'getPublicEvent',
      summary: 'One public event',
      responses: {
        '200': {
          description: 'The public event.',
          content: { 'application/json': { schema: publicEventRef } },
        },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/events': {
    get: {
      operationId: 'listAdminEvents',
      summary: 'Event list for an editor',
      description:
        'Requires content.read. Page { items, page, pageSize, total }. Query: q, page, pageSize, sort, dir, filters.kind, filters.verification. Search matches title and place. The default sort is date ascending.',
      responses: { '200': { description: 'A page of events, including drafts and notes.' } },
    },
    post: {
      operationId: 'createEvent',
      summary: 'Create an event',
      description:
        'Requires content.write. An editor and an administrator both have that permission. verified requires a public https source URL. Publishing does not change the listing. Omitted body becomes a placeholder. Omitted times stay blank.',
      responses: {
        '201': { description: 'Created.', content: { 'application/json': { schema: eventRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Role or CSRF refusal.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/events/{id}': {
    get: {
      operationId: 'getAdminEvent',
      summary: 'One event, including a draft and the private notes',
    },
    patch: {
      operationId: 'updateEvent',
      summary: 'Edit an event',
      description:
        'Omitted fields stay as they are. An omitted body is left in place. Times are HH:MM in Africa/Accra, which is UTC, and the end must be later the same day.',
    },
    delete: { operationId: 'deleteEvent', summary: 'Delete an event' },
  },
  '/api/v1/admin/events/{id}/publish': {
    post: {
      operationId: 'publishEvent',
      summary: 'Mark an event published',
      description:
        'Does not change the listing and does not confirm a date that is still to be confirmed.',
    },
  },
  '/api/v1/admin/events/{id}/unpublish': {
    post: { operationId: 'unpublishEvent', summary: 'Return an event to draft' },
  },
};

export const eventSchemas = {
  Event: {
    type: 'object',
    description:
      'Admin event. dateTbc means the date is not confirmed. startTime and endTime are Africa/Accra clock times, which are UTC. internalNotes stay off the public object.',
    required: [
      'id',
      'title',
      'date',
      'dateTbc',
      'whenLabel',
      'place',
      'kind',
      'verified',
      'sample',
      'summary',
      'body',
      'source',
      'sourceUrl',
      'image',
      'showOnAnniversary',
      'calendarDownload',
      'startTime',
      'endTime',
      'publicationStatus',
      'listing',
      'internalNotes',
    ],
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      date: { type: 'string' },
      dateTbc: { type: 'boolean' },
      whenLabel: { type: 'string' },
      place: { type: 'string' },
      kind: { type: 'string', enum: ['Milestone', 'Anniversary', 'Partner event'] },
      verified: { type: 'boolean' },
      sample: { type: 'boolean' },
      summary: { type: 'string' },
      body: { type: 'object' },
      source: { type: 'string' },
      sourceUrl: { type: 'string' },
      image: { type: 'string' },
      showOnAnniversary: { type: 'boolean' },
      calendarDownload: { type: 'boolean' },
      startTime: { type: 'string' },
      endTime: { type: 'string' },
      publicationStatus: {
        type: 'string',
        enum: ['draft', 'in_review', 'scheduled', 'published'],
      },
      listing: { type: 'string', enum: ['hidden', 'sample', 'public'] },
      internalNotes: { type: 'string' },
      lessonIds: { type: 'array', items: { type: 'string' } },
      projectIds: { type: 'array', items: { type: 'string' } },
      mediaIds: { type: 'array', items: { type: 'string' } },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PublicEvent: {
    type: 'object',
    description:
      'An event without internalNotes. The same fields the website shows on the public page.',
  },
};
