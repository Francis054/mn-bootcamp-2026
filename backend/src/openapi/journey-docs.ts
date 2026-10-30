const errorRef = { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } };
const missing = { description: 'Not available.', content: errorRef };
const invalid = { description: 'The form failed validation.', content: errorRef };
const authed = {
  '401': { description: 'Sign in to continue.', content: errorRef },
  '403': { description: 'You do not have access to that.', content: errorRef },
};
const slugParam = { name: 'slug', in: 'path', required: true, schema: { type: 'string' } };
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

/**
 * A trainee journey is computed when it is read. There is no journey table.
 * Custom milestones are the only rows this feature stores.
 * The public route returns public items for a published, consented profile.
 * It does not return drafts, private milestones, emails, or CV data.
 */
export const journeyPaths = {
  '/api/v1/public/trainees/{slug}/journey': {
    get: {
      operationId: 'getPublicJourney',
      summary: 'Public journey for one trainee',
      description:
        'Anyone. Only a published profile with consent. The body is public items: timetable blocks and weeks, approved labs, published projects, approved events, achieved skills, account milestones, and public custom milestones. Drafts, private milestones, emails, and CV data are omitted. A missing or private profile is 404.',
      parameters: [slugParam],
      responses: {
        '200': { description: 'The public journey.', content: json('Journey') },
        '404': missing,
      },
    },
  },
  '/api/v1/portal/journey': {
    get: {
      operationId: 'getOwnJourney',
      summary: 'The signed-in trainee’s journey',
      description:
        'Requires portal.access. The trainee id comes from the session. Includes private milestones and unpublished labs, projects, skills, and events for that trainee.',
      responses: {
        '200': { description: 'The trainee’s journey.', content: json('Journey') },
        ...authed,
      },
    },
  },
  '/api/v1/portal/journey/milestones': {
    post: {
      operationId: 'createJourneyMilestone',
      summary: 'Add a milestone',
      description: 'Requires portal.write and X-CSRF-Token. Title, date, and private or public are required.',
      requestBody: jsonBody('MilestoneWrite'),
      responses: {
        '201': { description: 'Saved.', content: json('Milestone') },
        '422': invalid,
        ...authed,
      },
    },
  },
  '/api/v1/portal/journey/milestones/{id}': {
    patch: {
      operationId: 'updateJourneyMilestone',
      summary: 'Edit a milestone',
      description: 'Requires portal.write and X-CSRF-Token. Another trainee’s milestone is not found.',
      parameters: [idParam],
      requestBody: jsonBody('MilestoneWrite'),
      responses: {
        '200': { description: 'Saved.', content: json('Milestone') },
        '422': invalid,
        '404': missing,
        ...authed,
      },
    },
    delete: {
      operationId: 'deleteJourneyMilestone',
      summary: 'Delete a milestone',
      description: 'Requires portal.write and X-CSRF-Token. Another trainee’s milestone is not found.',
      parameters: [idParam],
      responses: {
        '200': { description: 'Deleted.', content: json('DeletedId') },
        '404': missing,
        ...authed,
      },
    },
  },
};

export const journeySchemas = {
  JourneyItem: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'kind', 'title', 'summary', 'occurredOn', 'visibility', 'state', 'href', 'blockId', 'deliverables', 'editable'],
    properties: {
      id: { type: 'string' },
      kind: { type: 'string', enum: ['block', 'week', 'lab', 'project', 'event', 'skill', 'account', 'milestone'] },
      title: { type: 'string' },
      summary: { type: 'string' },
      occurredOn: { type: 'string', nullable: true },
      visibility: { type: 'string', enum: ['private', 'public'] },
      state: { type: 'string', enum: ['done', 'now', 'upcoming', 'recorded'] },
      href: { type: 'string', nullable: true },
      blockId: { type: 'string', nullable: true },
      deliverables: { type: 'array', items: { type: 'string' } },
      editable: { type: 'boolean' },
    },
  },
  Journey: {
    type: 'object',
    additionalProperties: false,
    required: ['displayName', 'slug', 'today', 'startsOn', 'endsOn', 'items'],
    properties: {
      displayName: { type: 'string' },
      slug: { type: 'string' },
      today: { type: 'string' },
      startsOn: { type: 'string', nullable: true },
      endsOn: { type: 'string', nullable: true },
      items: { type: 'array', items: { $ref: '#/components/schemas/JourneyItem' } },
    },
  },
  MilestoneWrite: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      occurredOn: { type: 'string' },
      visibility: { type: 'string', enum: ['private', 'public'] },
    },
  },
  Milestone: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'title', 'summary', 'occurredOn', 'visibility'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      summary: { type: 'string' },
      occurredOn: { type: 'string' },
      visibility: { type: 'string', enum: ['private', 'public'] },
    },
  },
};

function json(name: string) {
  return { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } };
}

function jsonBody(name: string) {
  return { required: true, content: json(name) };
}
