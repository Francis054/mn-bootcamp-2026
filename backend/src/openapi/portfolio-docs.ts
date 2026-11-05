const errorRef = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } },
};

const itemParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const mediaParam = { name: 'mediaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

const authed = {
  '401': { description: 'Sign in to continue.', content: errorRef },
  '403': { description: 'You do not have access to that.', content: errorRef },
};

/**
 * Trainee portfolio routes. The trainee id is taken from the session.
 * Pictures use the existing JPEG, PNG, and WebP pipeline. Videos are either
 * an MP4, WebM, or MOV upload, or a YouTube, Vimeo, or Loom link.
 */
export const portfolioPaths = {
  '/api/v1/portal/portfolio': {
    get: {
      operationId: 'listOwnPortfolio',
      summary: 'List the signed-in trainee’s portfolio items',
      description: 'Requires portal.access. Drafts of other trainees are not included.',
      responses: {
        '200': { description: 'The trainee’s own items, including drafts.', content: json('PortfolioItemList') },
        ...authed,
      },
    },
    post: {
      operationId: 'createPortfolioItem',
      summary: 'Create a portfolio item',
      description: 'Requires portal.write. Kind is project, lab, or case_study. The item stays a draft until it is submitted.',
      requestBody: jsonBody('PortfolioItemWrite'),
      responses: {
        '201': { description: 'Created.', content: json('PortfolioItem') },
        '422': { description: 'The form failed validation.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/reorder': {
    post: {
      operationId: 'reorderPortfolioItems',
      summary: 'Reorder the signed-in trainee’s portfolio items',
      description: 'Requires portal.write. The body lists every item id once. Order changes are saved immediately.',
      requestBody: jsonBody('PortfolioReorder'),
      responses: {
        '200': { description: 'The reordered items.', content: json('PortfolioItemList') },
        '422': { description: 'The list did not include every item once.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}': {
    get: {
      operationId: 'getOwnPortfolioItem',
      summary: 'Read one of the signed-in trainee’s portfolio items',
      description: 'Requires portal.access. Another trainee’s item, including a draft, is not found.',
      parameters: [itemParam],
      responses: {
        '200': { description: 'The item.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        ...authed,
      },
    },
    patch: {
      operationId: 'updateOwnPortfolioItem',
      summary: 'Edit one of the signed-in trainee’s portfolio items',
      description: 'Requires portal.write. A change to an approved item becomes a draft. The last approved version stays public.',
      parameters: [itemParam],
      requestBody: jsonBody('PortfolioItemWrite'),
      responses: {
        '200': { description: 'Saved.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The form failed validation.', content: errorRef },
        ...authed,
      },
    },
    delete: {
      operationId: 'deleteOwnPortfolioItem',
      summary: 'Delete one of the signed-in trainee’s portfolio items',
      description: 'Requires portal.write. The public copy is removed immediately.',
      parameters: [itemParam],
      responses: {
        '200': { description: 'Deleted.', content: json('DeletedId') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/submit': {
    post: {
      operationId: 'submitPortfolioItem',
      summary: 'Submit a portfolio item for review',
      description: 'Requires portal.write and public-profile consent. The last approved version stays public.',
      parameters: [itemParam],
      responses: {
        '200': { description: 'Waiting for review.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The item cannot be submitted.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/images': {
    post: {
      operationId: 'addPortfolioImage',
      summary: 'Add a picture to a portfolio item',
      description:
        'Requires portal.write. Multipart field file. JPEG, PNG, or WebP only. SVG is refused. Location data is removed before the file is stored. Alt text is required.',
      parameters: [itemParam],
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', required: ['file', 'alt'], properties: { file: { type: 'string', format: 'binary' }, alt: { type: 'string' } } } } },
      },
      responses: {
        '201': { description: 'The picture is on the draft.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The file was refused.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/images/{mediaId}': {
    delete: {
      operationId: 'removePortfolioImage',
      summary: 'Remove a picture from a portfolio draft',
      parameters: [itemParam, mediaParam],
      responses: {
        '200': { description: 'Removed from the draft.', content: json('PortfolioItem') },
        '404': { description: 'That picture is not available.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/videos': {
    post: {
      operationId: 'addPortfolioVideoLink',
      summary: 'Add a YouTube, Vimeo, or Loom link',
      description: 'Requires portal.write. Other hosts are refused. The page embeds the official player, not the address the trainee typed.',
      parameters: [itemParam],
      requestBody: jsonBody('PortfolioVideoLink'),
      responses: {
        '201': { description: 'The link is on the draft.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The link was refused.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/videos/grant': {
    post: {
      operationId: 'grantPortfolioVideoUpload',
      summary: 'Start a video upload',
      description:
        'Requires portal.write. Checks the declared type (MP4, WebM, or MOV) and size against VIDEO_UPLOAD_MAX_BYTES. When Cloudinary is configured the response is a short-lived signed upload to Cloudinary’s video endpoint, and the file does not pass through this API. In development and tests the mode is api and the file is posted to the file route.',
      parameters: [itemParam],
      requestBody: jsonBody('PortfolioVideoGrantRequest'),
      responses: {
        '201': { description: 'The upload can start.', content: json('PortfolioVideoGrant') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The type or size was refused.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/videos/file': {
    post: {
      operationId: 'uploadPortfolioVideoFile',
      summary: 'Upload a video through the API',
      description:
        'Requires portal.write. Used when storage is in memory. The bytes are sniffed. MP4, WebM, and MOV only, within the size limit. When Cloudinary is configured this route refuses the file so a large video is not buffered here.',
      parameters: [itemParam],
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', required: ['file', 'grantId'], properties: { file: { type: 'string', format: 'binary' }, grantId: { type: 'string' } } } } },
      },
      responses: {
        '201': { description: 'The video is on the draft.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The file was refused.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/videos/complete': {
    post: {
      operationId: 'completePortfolioVideoUpload',
      summary: 'Confirm a direct video upload',
      description:
        'Requires portal.write. Asks Cloudinary for the uploaded video and keeps it only when the format is mp4, webm, or mov and the size is within the limit.',
      parameters: [itemParam],
      requestBody: jsonBody('PortfolioVideoComplete'),
      responses: {
        '201': { description: 'The video is on the draft.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The upload was refused.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/videos/{mediaId}': {
    delete: {
      operationId: 'removePortfolioVideo',
      summary: 'Remove a video from a portfolio draft',
      parameters: [itemParam, mediaParam],
      responses: {
        '200': { description: 'Removed from the draft.', content: json('PortfolioItem') },
        '404': { description: 'That video is not available.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/portal/portfolio/{id}/media/reorder': {
    post: {
      operationId: 'reorderPortfolioMedia',
      summary: 'Reorder pictures and videos on a draft',
      parameters: [itemParam],
      requestBody: jsonBody('PortfolioReorder'),
      responses: {
        '200': { description: 'Reordered.', content: json('PortfolioItem') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        '422': { description: 'The list did not include every picture and video once.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/public/trainees/{id}/portfolio': {
    get: {
      operationId: 'getPublicPortfolio',
      summary: 'Approved portfolio items for a public trainee profile',
      description:
        'Returns the last approved version only. Hidden unless the trainee profile is public. Pictures and videos are omitted unless the trainee has agreed to a public photo. The response is not cached.',
      parameters: [itemParam],
      responses: {
        '200': { description: 'Approved items.', content: json('PublicPortfolioList') },
        '404': { description: 'That page is not available.', content: errorRef },
      },
    },
  },
  '/api/v1/admin/review-queue/items': {
    get: {
      operationId: 'listPortfolioReviewQueue',
      summary: 'Portfolio items waiting for review',
      description: 'Requires content.read. Profiles stay on GET /admin/review-queue.',
      responses: {
        '200': { description: 'Pending items.', content: json('PortfolioReviewList') },
        ...authed,
      },
    },
  },
  '/api/v1/admin/review-queue/items/{id}': {
    patch: {
      operationId: 'editPortfolioReviewItem',
      summary: 'Edit a portfolio item that is waiting for review',
      description: 'Requires content.write. Writes an audit row. Does not replace the public version until it is approved.',
      parameters: [itemParam],
      requestBody: jsonBody('PortfolioItemWrite'),
      responses: {
        '200': { description: 'The pending item.', content: json('PortfolioReviewItem') },
        '404': { description: 'That item is not waiting for review.', content: errorRef },
        '422': { description: 'The form failed validation.', content: errorRef },
        ...authed,
      },
    },
    delete: {
      operationId: 'deletePortfolioReviewItem',
      summary: 'Delete a portfolio item',
      description: 'Requires content.write. Removes the draft and the last approved version. Writes an audit row.',
      parameters: [itemParam],
      responses: {
        '200': { description: 'Deleted.', content: json('DeletedId') },
        '404': { description: 'That portfolio item is not available.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/admin/review-queue/items/{id}/approve': {
    post: {
      operationId: 'approvePortfolioItem',
      summary: 'Approve a portfolio item',
      description: 'Requires content.write. The pending version becomes the public version. Writes an audit row.',
      parameters: [itemParam],
      responses: {
        '200': { description: 'Approved.', content: json('PortfolioReviewItem') },
        '404': { description: 'That item is not waiting for review.', content: errorRef },
        ...authed,
      },
    },
  },
  '/api/v1/admin/review-queue/items/{id}/reject': {
    post: {
      operationId: 'rejectPortfolioItem',
      summary: 'Reject a portfolio item',
      description: 'Requires content.write. The reason is shown to the trainee. The last approved version stays public. Writes an audit row.',
      parameters: [itemParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', maxLength: 500 } } } } },
      },
      responses: {
        '200': { description: 'Rejected.', content: json('PortfolioReviewItem') },
        '404': { description: 'That item is not waiting for review.', content: errorRef },
        '422': { description: 'A reason is required.', content: errorRef },
        ...authed,
      },
    },
  },
};

function json(name: string) {
  return { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } };
}

function jsonBody(name: string) {
  return { required: true, content: json(name) };
}

export const portfolioSchemas = {
  PortfolioItemWrite: {
    type: 'object',
    additionalProperties: true,
    properties: {
      kind: { type: 'string', enum: ['project', 'lab', 'case_study'] },
      title: { type: 'string' },
      summary: { type: 'string' },
      skills: { type: 'array', items: { type: 'string' } },
      startedOn: { type: 'string', nullable: true },
      completedOn: { type: 'string', nullable: true },
      repositoryUrl: { type: 'string', nullable: true },
      demoUrl: { type: 'string', nullable: true },
    },
  },
  PortfolioReorder: {
    type: 'object',
    required: ['ids'],
    properties: { ids: { type: 'array', items: { type: 'string' } } },
  },
  PortfolioVideoLink: {
    type: 'object',
    required: ['url'],
    properties: { url: { type: 'string' } },
  },
  PortfolioVideoGrantRequest: {
    type: 'object',
    required: ['mime', 'bytes'],
    properties: {
      mime: { type: 'string', enum: ['video/mp4', 'video/webm', 'video/quicktime'] },
      bytes: { type: 'integer' },
    },
  },
  PortfolioVideoComplete: {
    type: 'object',
    required: ['grantId'],
    properties: { grantId: { type: 'string', format: 'uuid' } },
  },
  PortfolioVideoGrant: { type: 'object', additionalProperties: true },
  PortfolioItem: { type: 'object', additionalProperties: true },
  PortfolioItemList: { type: 'array', items: { $ref: '#/components/schemas/PortfolioItem' } },
  PublicPortfolioList: { type: 'array', items: { type: 'object', additionalProperties: true } },
  PortfolioReviewItem: { type: 'object', additionalProperties: true },
  PortfolioReviewList: { type: 'array', items: { $ref: '#/components/schemas/PortfolioReviewItem' } },
  DeletedId: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
};
