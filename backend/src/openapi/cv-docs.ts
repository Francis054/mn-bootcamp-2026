const errorRef = { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } };
const missing = { description: 'Not available.', content: errorRef };
const invalid = { description: 'The form failed validation.', content: errorRef };
const limited = { description: 'Too many CV uploads or downloads.', content: errorRef };
const authed = {
  '401': { description: 'Sign in to continue.', content: errorRef },
  '403': { description: 'You do not have access to that.', content: errorRef },
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const traineeParam = { name: 'traineeId', in: 'path', required: true, schema: { type: 'string' } };
const tokenParam = { name: 'token', in: 'path', required: true, schema: { type: 'string' } };
const pdf = {
  '200': {
    description: 'The PDF as a download. It is never shown in the browser.',
    headers: {
      'Content-Disposition': { schema: { type: 'string' } },
      'X-Content-Type-Options': { schema: { type: 'string' } },
    },
    content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
  },
  '404': missing,
  '429': limited,
};

/**
 * Trainee CVs. The file stays in a private bucket. Public responses say only whether a CV
 * can be downloaded or requested. They never include a file address.
 * An on-request CV is asked for at POST /public/trainees/{id}/cv-request.
 * Editors and administrators can both approve a CV. Moving an approved CV from on request to public does not send it back for review.
 */
export const cvPaths = {
  '/api/v1/portal/cv': {
    get: {
      operationId: 'getOwnCv',
      summary: 'Read the signed-in trainee’s CV details',
      description: 'Requires portal.access. There is no file address.',
      responses: {
        '200': { description: 'The current CV, or none.', content: json('CvEnvelope') },
        ...authed,
      },
    },
    post: {
      operationId: 'uploadOwnCv',
      summary: 'Upload or replace a CV',
      description:
        'Requires portal.write. PDF only, at most 5 MB and 10 pages. The new file waits for review. The previous file is deleted.',
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CvUpload' } } },
      },
      responses: {
        '201': { description: 'Saved and waiting for review.', content: json('CvView') },
        '422': invalid,
        '429': limited,
        ...authed,
      },
    },
    patch: {
      operationId: 'setOwnCvVisibility',
      summary: 'Choose who can receive the CV',
      description:
        'Requires portal.write. Private, on request, or public. Public download still waits for approval.',
      requestBody: { required: true, content: json('CvVisibilityWrite') },
      responses: {
        '200': { description: 'Saved.', content: json('CvView') },
        '422': invalid,
        '404': missing,
        ...authed,
      },
    },
    delete: {
      operationId: 'removeOwnCv',
      summary: 'Remove the signed-in trainee’s CV',
      description: 'Requires portal.write. The file is deleted.',
      responses: {
        '200': { description: 'Removed.', content: json('CvRemoved') },
        '404': missing,
        ...authed,
      },
    },
  },
  '/api/v1/portal/cv/file': {
    get: {
      operationId: 'downloadOwnCv',
      summary: 'Download the signed-in trainee’s CV',
      description: 'Requires portal.access. The response is an attachment and is not cached.',
      responses: { ...pdf, ...authed },
    },
  },
  '/api/v1/public/trainees/{id}/cv-link': {
    post: {
      operationId: 'mintPublicCvLink',
      summary: 'Ask for a short download link',
      description:
        'Only when the profile is public, the CV is approved, and the trainee chose public. The link lasts five minutes. It is not cached.',
      parameters: [idParam],
      responses: {
        '200': {
          description: 'A path on this API, not a storage address.',
          content: json('CvLink'),
        },
        '404': missing,
        '429': limited,
      },
    },
  },
  '/api/v1/public/cv/{token}': {
    get: {
      operationId: 'downloadPublicCv',
      summary: 'Download a CV with a signed link',
      description:
        'The PDF is an attachment. An expired or unknown link is refused. The response is not cached.',
      parameters: [tokenParam],
      responses: pdf,
    },
  },
  '/api/v1/admin/review-queue/cvs': {
    get: {
      operationId: 'listCvReviewQueue',
      summary: 'List CVs waiting for review',
      description: 'Requires content.read.',
      responses: { '200': { description: 'Waiting CVs.', content: json('CvQueue') }, ...authed },
    },
  },
  '/api/v1/admin/review-queue/cvs/{id}/approve': {
    post: {
      operationId: 'approveCv',
      summary: 'Approve a CV',
      description:
        'Requires content.write. A public download still needs the trainee to choose public.',
      parameters: [idParam],
      responses: {
        '200': { description: 'Approved.', content: json('CvQueueItem') },
        '404': missing,
        ...authed,
      },
    },
  },
  '/api/v1/admin/review-queue/cvs/{id}/reject': {
    post: {
      operationId: 'rejectCv',
      summary: 'Reject a CV',
      description: 'Requires content.write. The trainee sees the reason.',
      parameters: [idParam],
      requestBody: { required: true, content: json('RejectReason') },
      responses: {
        '200': { description: 'Rejected.', content: json('CvQueueItem') },
        '422': invalid,
        '404': missing,
        ...authed,
      },
    },
  },
  '/api/v1/admin/trainees/{traineeId}/cv': {
    get: {
      operationId: 'getTraineeCv',
      summary: 'See a trainee’s CV details',
      description: 'Requires content.read. There is no file address.',
      parameters: [traineeParam],
      responses: {
        '200': { description: 'The current CV, or none.', content: json('CvEnvelope') },
        '404': missing,
        ...authed,
      },
    },
    post: {
      operationId: 'replaceTraineeCv',
      summary: 'Replace a trainee’s CV',
      description:
        'Administrators only. The previous file is deleted and the new one waits for review.',
      parameters: [traineeParam],
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { $ref: '#/components/schemas/CvUpload' } } },
      },
      responses: {
        '201': { description: 'Saved and waiting for review.', content: json('CvView') },
        '422': invalid,
        '429': limited,
        ...authed,
      },
    },
    delete: {
      operationId: 'removeTraineeCv',
      summary: 'Remove a trainee’s CV',
      description: 'Administrators only. The file is deleted.',
      parameters: [traineeParam],
      responses: {
        '200': { description: 'Removed.', content: json('CvRemoved') },
        '404': missing,
        ...authed,
      },
    },
  },
  '/api/v1/admin/trainees/{traineeId}/cv/file': {
    get: {
      operationId: 'downloadTraineeCv',
      summary: 'Download a trainee’s CV',
      description:
        'Administrators only. Editors can approve a CV but cannot download it. The response is not cached.',
      parameters: [traineeParam],
      responses: { ...pdf, ...authed },
    },
  },
};

function json(name: string) {
  return { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } };
}

export const cvSchemas = {
  CvUpload: {
    type: 'object',
    required: ['file'],
    properties: {
      file: { type: 'string', format: 'binary' },
      visibility: { type: 'string', enum: ['private', 'on_request', 'public'] },
    },
  },
  CvVisibilityWrite: {
    type: 'object',
    additionalProperties: false,
    required: ['visibility'],
    properties: { visibility: { type: 'string', enum: ['private', 'on_request', 'public'] } },
  },
  CvView: { type: 'object', additionalProperties: true },
  CvEnvelope: { type: 'object', additionalProperties: true },
  CvQueue: { type: 'array', items: { $ref: '#/components/schemas/CvQueueItem' } },
  CvQueueItem: { type: 'object', additionalProperties: true },
  CvLink: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'expiresAt'],
    properties: {
      path: { type: 'string' },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  },
  CvRemoved: {
    type: 'object',
    additionalProperties: false,
    required: ['removed'],
    properties: { removed: { type: 'boolean' } },
  },
  PublicCv: {
    type: 'object',
    additionalProperties: false,
    required: ['available', 'mode'],
    description: 'Whether a visitor can download or ask for a CV. Never a file address.',
    properties: {
      available: { type: 'boolean' },
      mode: { type: 'string', nullable: true, enum: ['public', 'on_request', null] },
    },
  },
};
