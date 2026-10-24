const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const homeRef = { $ref: '#/components/schemas/HomepageContent' };
const aboutRef = { $ref: '#/components/schemas/AboutContent' };
const milestoneRef = { $ref: '#/components/schemas/Milestone' };

export const contentPaths = {
  '/api/v1/public/home': {
    get: {
      operationId: 'getPublicHome',
      summary: 'Published homepage, including the announcement banner',
      description:
        'Returned only after an editor publishes the homepage. The announcement banner is the announcement field. showAnnouncement false keeps the words in the document and the site can hide the banner. There is no separate announcements collection.',
      responses: {
        '200': {
          description: 'The published homepage.',
          content: { 'application/json': { schema: homeRef } },
        },
        '404': { description: 'Not published.', content: errorRef },
      },
    },
  },
  '/api/v1/public/about': {
    get: {
      operationId: 'getPublicAbout',
      summary: 'Published about page',
      responses: {
        '200': {
          description: 'The published about page.',
          content: { 'application/json': { schema: aboutRef } },
        },
        '404': { description: 'Not published.', content: errorRef },
      },
    },
  },
  '/api/v1/public/milestones': {
    get: {
      operationId: 'listPublicMilestones',
      summary: 'Published timeline',
      description:
        'An empty array until the timeline is published. Draft order stays on the admin route.',
      responses: {
        '200': {
          description: 'Published milestones, in stored order.',
          content: {
            'application/json': { schema: { type: 'array', items: milestoneRef } },
          },
        },
      },
    },
  },
  '/api/v1/public/foundation-stats': {
    get: {
      operationId: 'listPublicFoundationStats',
      summary: 'Published foundation counters',
      description:
        'Counters are stored with settings. This list is empty until settings are published. It does not include the contact email. The seed uses labelled zeros.',
      responses: {
        '200': {
          description: 'Published counters, or an empty array.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/FoundationStat' } },
            },
          },
        },
      },
    },
  },
  '/api/v1/admin/home': {
    get: {
      operationId: 'getAdminHome',
      summary: 'Homepage draft, including unpublished edits',
      description: 'Requires content.read. Adds publicationStatus to the homepage shape.',
    },
    put: {
      operationId: 'updateHome',
      summary: 'Edit the homepage draft',
      description:
        'Requires content.write. Omitted fields stay as they are. This does not publish. publicationStatus in the body is ignored.',
      responses: {
        '200': { description: 'The draft.' },
        '401': { description: 'Sign in.', content: errorRef },
        '403': { description: 'Role or CSRF refusal.', content: errorRef },
        '422': { description: 'Field errors.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/home/publish': {
    post: {
      operationId: 'publishHome',
      summary: 'Publish the homepage draft',
      description: 'Requires content.write. Copies the draft to the public homepage.',
    },
  },
  '/api/v1/admin/home/unpublish': {
    post: {
      operationId: 'unpublishHome',
      summary: 'Take the homepage off the public site',
      description: 'Requires content.write. The draft remains for editors.',
    },
  },
  '/api/v1/admin/about': {
    get: { operationId: 'getAdminAbout', summary: 'About draft' },
    put: {
      operationId: 'updateAbout',
      summary: 'Edit the about draft',
      description:
        'Requires content.write. Omitted address, email, and website stay as they are. figuresPermission does not publish counters. publicationStatus in the body is ignored.',
    },
  },
  '/api/v1/admin/about/publish': {
    post: { operationId: 'publishAbout', summary: 'Publish the about draft' },
  },
  '/api/v1/admin/about/unpublish': {
    post: { operationId: 'unpublishAbout', summary: 'Take the about page off the public site' },
  },
  '/api/v1/admin/milestones': {
    get: {
      operationId: 'listAdminMilestones',
      summary: 'Timeline draft',
      description:
        'Requires content.read. A bare array, in the stored order. The form reorders this array.',
    },
    put: {
      operationId: 'updateMilestones',
      summary: 'Replace the timeline draft',
      description:
        'Requires content.write. Body { milestones }. The array order is the timeline order. This does not publish.',
    },
  },
  '/api/v1/admin/milestones/publish': {
    post: { operationId: 'publishMilestones', summary: 'Publish the timeline' },
  },
  '/api/v1/admin/milestones/unpublish': {
    post: { operationId: 'unpublishMilestones', summary: 'Take the timeline off the public site' },
  },
  '/api/v1/admin/settings': {
    get: {
      operationId: 'getAdminSettings',
      summary: 'Settings draft, including foundation counters',
      description: 'Requires settings.manage. An editor does not have that permission.',
    },
    put: {
      operationId: 'updateSettings',
      summary: 'Edit settings',
      description:
        'Requires settings.manage. Site name is required. Contact email must be a valid address. Omitted counters stay as they are. This does not publish.',
    },
  },
  '/api/v1/admin/settings/publish': {
    post: {
      operationId: 'publishSettings',
      summary: 'Publish settings and the foundation counters',
    },
  },
  '/api/v1/admin/settings/unpublish': {
    post: {
      operationId: 'unpublishSettings',
      summary: 'Take settings and the counters off the public site',
    },
  },
};

export const contentSchemas = {
  HomepageContent: {
    type: 'object',
    additionalProperties: false,
    required: [
      'eyebrow',
      'headline',
      'lead',
      'ctaLabel',
      'ctaHref',
      'theme',
      'announcement',
      'showAnnouncement',
      'footerCtaHeading',
      'footerCtaHref',
    ],
    properties: {
      eyebrow: { type: 'string' },
      headline: { type: 'string' },
      lead: { type: 'string' },
      ctaLabel: { type: 'string' },
      ctaHref: { type: 'string' },
      theme: { type: 'string', enum: ['dark', 'light'] },
      announcement: { type: 'string' },
      showAnnouncement: { type: 'boolean' },
      footerCtaHeading: { type: 'string' },
      footerCtaHref: { type: 'string' },
    },
  },
  AboutContent: {
    type: 'object',
    additionalProperties: false,
    required: ['mission', 'vision', 'values', 'address', 'email', 'website', 'figuresPermission'],
    properties: {
      mission: { type: 'string' },
      vision: { type: 'string' },
      values: { type: 'array', items: { type: 'string' } },
      address: { type: 'string' },
      email: { type: 'string' },
      website: { type: 'string' },
      figuresPermission: { type: 'boolean' },
    },
  },
  Milestone: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'year', 'title', 'description', 'source'],
    properties: {
      id: { type: 'string' },
      year: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
      source: { type: 'string' },
    },
  },
  FoundationStat: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'label', 'value', 'suffix'],
    properties: {
      id: { type: 'string' },
      label: { type: 'string' },
      value: { type: 'integer', minimum: 0 },
      suffix: { type: 'string' },
    },
  },
  SiteSettings: {
    type: 'object',
    required: [
      'siteName',
      'timeZone',
      'contactEmail',
      'accent',
      'reduceMotion',
      'notifications',
      'foundationStats',
    ],
    properties: {
      siteName: { type: 'string' },
      timeZone: { type: 'string' },
      contactEmail: { type: 'string' },
      accent: { type: 'string' },
      reduceMotion: { type: 'boolean' },
      notifications: {
        type: 'object',
        required: ['projects', 'consent', 'digest'],
        properties: {
          projects: { type: 'boolean' },
          consent: { type: 'boolean' },
          digest: { type: 'boolean' },
        },
      },
      foundationStats: {
        type: 'array',
        items: { $ref: '#/components/schemas/FoundationStat' },
      },
      publicationStatus: {
        type: 'string',
        enum: ['draft', 'in_review', 'scheduled', 'published'],
        description: 'Present on the admin settings response. Ignored on write.',
      },
    },
  },
};
