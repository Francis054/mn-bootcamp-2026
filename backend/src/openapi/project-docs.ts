const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const projectRef = { $ref: '#/components/schemas/Project' };
const publicProjectRef = { $ref: '#/components/schemas/PublicProject' };

export const projectPaths = {
  '/api/v1/public/projects': {
    get: {
      operationId: 'listPublicProjects',
      summary: 'Published projects',
      description:
        'A project is returned when publicationStatus is published and listing is not hidden. repositoryUrl and demoUrl are included only when every linked trainee has linksShareConsent and the project is published. A GitHub repository that does not answer 200 is omitted. There is no project bulk action.',
      responses: {
        '200': {
          description: 'Public projects.',
          content: {
            'application/json': { schema: { type: 'array', items: publicProjectRef } },
          },
        },
      },
    },
  },
  '/api/v1/public/projects/{id}': {
    get: {
      operationId: 'getPublicProject',
      summary: 'One published project',
      responses: {
        '200': {
          description:
            'The public project. Links are present only when consent and publication allow them.',
          content: { 'application/json': { schema: publicProjectRef } },
        },
        '404': { description: 'Missing or not public.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/projects': {
    get: {
      operationId: 'listAdminProjects',
      summary: 'Project list for an editor',
      description:
        'Requires content.read. Page { items, page, pageSize, total }. Query: q, page, pageSize, sort, dir, filters.type. Search matches title and type.',
      responses: { '200': { description: 'A page of projects, including drafts and notes.' } },
    },
    post: {
      operationId: 'createProject',
      summary: 'Create a project',
      description:
        'Requires content.write. An editor and an administrator both have that permission. Publishing does not set link consent and does not change the listing. Link consent is linksShareConsent on the linked trainees.',
      responses: {
        '201': { description: 'Created.', content: { 'application/json': { schema: projectRef } } },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Role or CSRF refusal.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/projects/{id}': {
    get: {
      operationId: 'getAdminProject',
      summary: 'One project, including a draft and the private fields',
    },
    patch: {
      operationId: 'updateProject',
      summary: 'Edit a project',
      description:
        'Omitted fields stay as they are. shareAgreed is stored and does not publish the links.',
    },
    delete: { operationId: 'deleteProject', summary: 'Delete a project' },
  },
  '/api/v1/admin/projects/{id}/publish': {
    post: {
      operationId: 'publishProject',
      summary: 'Mark a project published',
      description: 'Does not change the listing and does not record link consent.',
    },
  },
  '/api/v1/admin/projects/{id}/unpublish': {
    post: { operationId: 'unpublishProject', summary: 'Return a project to draft' },
  },
};

export const projectSchemas = {
  Project: {
    type: 'object',
    description:
      'Admin project. traineeIds is the relation used for link consent. repositoryLinkNote is set when a stored repository link will stay off the public page.',
    required: [
      'id',
      'title',
      'slug',
      'type',
      'moduleId',
      'cover',
      'image',
      'abstract',
      'tools',
      'steps',
      'team',
      'repositoryUrl',
      'demoUrl',
      'labOnlyConfirmed',
      'shareAgreed',
      'publicationStatus',
      'listing',
      'internalNotes',
    ],
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      slug: { type: 'string' },
      type: { type: 'string', enum: ['Lab', 'CTF', 'Case study', 'Community project', 'Capstone'] },
      moduleId: { type: 'string' },
      cover: { type: 'string' },
      image: { type: 'string' },
      abstract: { type: 'string' },
      tools: { type: 'string' },
      steps: { type: 'array', items: { type: 'string' } },
      team: { type: 'array', items: { type: 'string' } },
      traineeIds: { type: 'array', items: { type: 'string' } },
      lessonIds: { type: 'array', items: { type: 'string' } },
      repositoryUrl: { type: 'string' },
      demoUrl: { type: 'string' },
      labOnlyConfirmed: { type: 'boolean' },
      shareAgreed: { type: 'boolean' },
      publicationStatus: {
        type: 'string',
        enum: ['draft', 'in_review', 'scheduled', 'published'],
      },
      listing: { type: 'string', enum: ['hidden', 'sample', 'public'] },
      internalNotes: { type: 'string' },
      repositoryLinkNote: { type: 'string', nullable: true },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PublicProject: {
    type: 'object',
    description:
      'A project without internalNotes, labOnlyConfirmed, and shareAgreed. repositoryUrl and demoUrl are present only when the links may be shown.',
  },
};
