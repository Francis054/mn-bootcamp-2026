const errorRef = { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } };
const missing = { description: 'Not available.', content: errorRef };
const invalid = { description: 'The form failed validation.', content: errorRef };
const authed = {
  '401': { description: 'Sign in to continue.', content: errorRef },
  '403': { description: 'You do not have access to that.', content: errorRef },
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const traineeParam = { name: 'traineeId', in: 'path', required: true, schema: { type: 'string' } };

/**
 * Trainee skills and events. The trainee id on portal routes comes from the session.
 * Public routes return the last approved version only, and only when the profile is public.
 * Certificate images use the JPEG, PNG, and WebP pipeline. Grades are not stored.
 */
export const progressPaths = {
  '/api/v1/portal/skills': {
    get: op('listOwnSkills', 'List the signed-in trainee’s skills', 'Requires portal.access.', '200', 'SkillList'),
    post: write('createSkill', 'Add a skill', 'Requires portal.write. The skill stays a draft until it is submitted.', '201', 'Skill', 'SkillWrite'),
  },
  '/api/v1/portal/skills/{id}': {
    patch: write('updateSkill', 'Edit a skill', 'Requires portal.write. A change to an approved skill becomes a draft.', '200', 'Skill', 'SkillWrite', [idParam]),
    delete: {
      operationId: 'deleteSkill',
      summary: 'Delete a skill',
      description: 'Requires portal.write. The public copy is removed immediately.',
      parameters: [idParam],
      responses: { '200': { description: 'Deleted.', content: json('DeletedId') }, '404': missing, ...authed },
    },
  },
  '/api/v1/portal/skills/{id}/submit': {
    post: {
      operationId: 'submitSkill',
      summary: 'Submit a skill for review',
      description: 'Requires portal.write and public-profile consent. The last approved version stays public.',
      parameters: [idParam],
      responses: { '200': { description: 'Waiting for review.', content: json('Skill') }, '422': invalid, ...authed },
    },
  },
  '/api/v1/portal/events': {
    get: op('listOwnEvents', 'List the signed-in trainee’s events', 'Requires portal.access.', '200', 'EventList'),
    post: write('createEvent', 'Add an event', 'Requires portal.write. The event stays a draft until it is submitted.', '201', 'TraineeEvent', 'EventWrite'),
  },
  '/api/v1/portal/events/{id}': {
    patch: write('updateEvent', 'Edit an event', 'Requires portal.write. A change to an approved event becomes a draft.', '200', 'TraineeEvent', 'EventWrite', [idParam]),
    delete: {
      operationId: 'deleteEvent',
      summary: 'Delete an event',
      description: 'Requires portal.write. The public copy is removed immediately.',
      parameters: [idParam],
      responses: { '200': { description: 'Deleted.', content: json('DeletedId') }, '404': missing, ...authed },
    },
  },
  '/api/v1/portal/events/{id}/submit': {
    post: {
      operationId: 'submitEvent',
      summary: 'Submit an event for review',
      description: 'Requires portal.write and public-profile consent.',
      parameters: [idParam],
      responses: { '200': { description: 'Waiting for review.', content: json('TraineeEvent') }, '422': invalid, ...authed },
    },
  },
  '/api/v1/portal/events/{id}/certificate': {
    post: {
      operationId: 'addEventCertificate',
      summary: 'Attach a certificate image',
      description: 'Requires portal.write. JPEG, PNG, or WebP. SVG is refused. Location data is removed. The image is not public until the event is approved and photo consent is on.',
      parameters: [idParam],
      responses: { '201': { description: 'Stored on the draft.', content: json('TraineeEvent') }, '422': invalid, ...authed },
    },
    delete: {
      operationId: 'removeEventCertificate',
      summary: 'Remove the certificate image from the draft',
      description: 'Requires portal.write.',
      parameters: [idParam],
      responses: { '200': { description: 'Removed from the draft.', content: json('TraineeEvent') }, ...authed },
    },
  },
  '/api/v1/public/trainees/{id}/skills': {
    get: {
      operationId: 'listPublicSkills',
      summary: 'Approved skills on a public profile',
      description: 'The profile must be published and the trainee must have agreed. Evidence is a portfolio item title, including a case study, and only when that item has an approved title. No email.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Approved skills.', content: json('PublicSkillList') }, '404': missing },
    },
  },
  '/api/v1/public/trainees/{id}/events': {
    get: {
      operationId: 'listPublicEvents',
      summary: 'Approved events on a public profile',
      description: 'The profile must be published and the trainee must have agreed. The certificate image is included only when photo consent is on.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Approved events.', content: json('PublicEventList') }, '404': missing },
    },
  },
  '/api/v1/admin/review-queue/skills': {
    get: op('listSkillQueue', 'Skills waiting for review', 'Requires content.read.', '200', 'SkillReviewList'),
  },
  '/api/v1/admin/review-queue/skills/{id}': {
    patch: write('editPendingSkill', 'Edit a skill that is waiting', 'Requires content.write. Writes an audit row.', '200', 'SkillReview', 'SkillWrite', [idParam]),
    delete: {
      operationId: 'deleteQueuedSkill',
      summary: 'Delete a skill from the queue',
      description: 'Requires content.write. Writes an audit row.',
      parameters: [idParam],
      responses: { '200': { description: 'Deleted.', content: json('DeletedId') }, ...authed },
    },
  },
  '/api/v1/admin/review-queue/skills/{id}/approve': {
    post: {
      operationId: 'approveSkill',
      summary: 'Approve a skill',
      description: 'Requires content.write. The approved text can appear on the public profile when consent is on. Writes an audit row.',
      parameters: [idParam],
      responses: { '200': { description: 'Approved.', content: json('SkillReview') }, ...authed },
    },
  },
  '/api/v1/admin/review-queue/skills/{id}/reject': {
    post: {
      operationId: 'rejectSkill',
      summary: 'Reject a skill',
      description: 'Requires content.write and a reason. Writes an audit row.',
      parameters: [idParam],
      requestBody: jsonBody('RejectReason'),
      responses: { '200': { description: 'Rejected.', content: json('SkillReview') }, '422': invalid, ...authed },
    },
  },
  '/api/v1/admin/review-queue/events': {
    get: op('listEventQueue', 'Events waiting for review', 'Requires content.read.', '200', 'EventReviewList'),
  },
  '/api/v1/admin/review-queue/events/{id}': {
    patch: write('editPendingEvent', 'Edit an event that is waiting', 'Requires content.write. Writes an audit row.', '200', 'EventReview', 'EventWrite', [idParam]),
    delete: {
      operationId: 'deleteQueuedEvent',
      summary: 'Delete an event from the queue',
      description: 'Requires content.write. Writes an audit row.',
      parameters: [idParam],
      responses: { '200': { description: 'Deleted.', content: json('DeletedId') }, ...authed },
    },
  },
  '/api/v1/admin/review-queue/events/{id}/approve': {
    post: {
      operationId: 'approveEvent',
      summary: 'Approve an event',
      description: 'Requires content.write. Writes an audit row.',
      parameters: [idParam],
      responses: { '200': { description: 'Approved.', content: json('EventReview') }, ...authed },
    },
  },
  '/api/v1/admin/review-queue/events/{id}/reject': {
    post: {
      operationId: 'rejectEvent',
      summary: 'Reject an event',
      description: 'Requires content.write and a reason. Writes an audit row.',
      parameters: [idParam],
      requestBody: jsonBody('RejectReason'),
      responses: { '200': { description: 'Rejected.', content: json('EventReview') }, '422': invalid, ...authed },
    },
  },
  '/api/v1/admin/trainees/{traineeId}/skills': {
    get: {
      operationId: 'listTraineeSkills',
      summary: 'Skills for one trainee',
      description: 'Requires content.read. Includes drafts.',
      parameters: [traineeParam],
      responses: { '200': { description: 'That trainee’s skills.', content: json('SkillList') }, '404': missing, ...authed },
    },
    post: {
      operationId: 'createTraineeSkill',
      summary: 'Add an approved skill for a trainee',
      description: 'Requires content.write. The skill is approved immediately and an audit row is written.',
      parameters: [traineeParam],
      requestBody: jsonBody('SkillWrite'),
      responses: { '201': { description: 'Created.', content: json('Skill') }, '422': invalid, ...authed },
    },
  },
  '/api/v1/admin/trainees/{traineeId}/skills/{id}': {
    patch: {
      operationId: 'editTraineeSkill',
      summary: 'Edit a trainee’s skill',
      description: 'Requires content.write. The live text is replaced and an audit row is written.',
      parameters: [traineeParam, idParam],
      requestBody: jsonBody('SkillWrite'),
      responses: { '200': { description: 'Saved.', content: json('Skill') }, ...authed },
    },
    delete: {
      operationId: 'deleteTraineeSkill',
      summary: 'Delete a trainee’s skill',
      description: 'Requires content.write. Writes an audit row.',
      parameters: [traineeParam, idParam],
      responses: { '200': { description: 'Deleted.', content: json('DeletedId') }, ...authed },
    },
  },
  '/api/v1/admin/trainees/{traineeId}/events': {
    get: {
      operationId: 'listTraineeEvents',
      summary: 'Events for one trainee',
      description: 'Requires content.read. Includes drafts.',
      parameters: [traineeParam],
      responses: { '200': { description: 'That trainee’s events.', content: json('EventList') }, '404': missing, ...authed },
    },
    post: {
      operationId: 'createTraineeEvent',
      summary: 'Add an approved event for a trainee',
      description: 'Requires content.write. The event is approved immediately and an audit row is written.',
      parameters: [traineeParam],
      requestBody: jsonBody('EventWrite'),
      responses: { '201': { description: 'Created.', content: json('TraineeEvent') }, '422': invalid, ...authed },
    },
  },
  '/api/v1/admin/trainees/{traineeId}/events/{id}': {
    patch: {
      operationId: 'editTraineeEvent',
      summary: 'Edit a trainee’s event',
      description: 'Requires content.write. The live text is replaced and an audit row is written.',
      parameters: [traineeParam, idParam],
      requestBody: jsonBody('EventWrite'),
      responses: { '200': { description: 'Saved.', content: json('TraineeEvent') }, ...authed },
    },
    delete: {
      operationId: 'deleteTraineeEvent',
      summary: 'Delete a trainee’s event',
      description: 'Requires content.write. Writes an audit row.',
      parameters: [traineeParam, idParam],
      responses: { '200': { description: 'Deleted.', content: json('DeletedId') }, ...authed },
    },
  },
  '/api/v1/admin/trainees/{traineeId}/events/{id}/certificate': {
    post: {
      operationId: 'addTraineeEventCertificate',
      summary: 'Replace a trainee’s certificate image',
      description: 'Requires content.write. JPEG, PNG, or WebP. Writes an audit row.',
      parameters: [traineeParam, idParam],
      responses: { '201': { description: 'Stored.', content: json('TraineeEvent') }, '422': invalid, ...authed },
    },
  },
  '/api/v1/progress/trainees': {
    get: {
      operationId: 'listProgressForTrainer',
      summary: 'Skills and events for a linked trainer',
      description: 'Requires progress.read. The login must be linked on a timetable trainer row. The response has display names, skills, and events. It does not include email addresses.',
      responses: {
        '200': { description: 'Trainees who have a skill or an event.', content: json('TrainerProgressList') },
        '401': { description: 'Sign in to continue.', content: errorRef },
        '403': { description: 'The login is not a linked trainer, or the role cannot read progress.', content: errorRef },
      },
    },
  },
};

function op(operationId: string, summary: string, description: string, status: string, schema: string) {
  return {
    operationId,
    summary,
    description,
    responses: { [status]: { description: 'Ok.', content: json(schema) }, ...authed },
  };
}

function write(
  operationId: string,
  summary: string,
  description: string,
  status: string,
  schema: string,
  body: string,
  parameters?: unknown[],
) {
  return {
    operationId,
    summary,
    description,
    ...(parameters ? { parameters } : {}),
    requestBody: jsonBody(body),
    responses: { [status]: { description: 'Saved.', content: json(schema) }, '422': invalid, '404': missing, ...authed },
  };
}

function json(name: string) {
  return { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } };
}

function jsonBody(name: string) {
  return { required: true, content: json(name) };
}

export const progressSchemas = {
  SkillWrite: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      level: { type: 'integer', minimum: 1, maximum: 4 },
      evidenceItemId: { type: 'string', format: 'uuid', nullable: true },
    },
  },
  EventWrite: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      eventDate: { type: 'string', nullable: true },
      organiser: { type: 'string' },
      link: { type: 'string', nullable: true },
    },
  },
  RejectReason: {
    type: 'object',
    additionalProperties: false,
    required: ['reason'],
    properties: { reason: { type: 'string' } },
  },
  SkillList: { type: 'array', items: { $ref: '#/components/schemas/Skill' } },
  EventList: { type: 'array', items: { $ref: '#/components/schemas/TraineeEvent' } },
  SkillReviewList: { type: 'array', items: { $ref: '#/components/schemas/SkillReview' } },
  EventReviewList: { type: 'array', items: { $ref: '#/components/schemas/EventReview' } },
  PublicSkillList: { type: 'array', items: { $ref: '#/components/schemas/PublicSkill' } },
  PublicEventList: { type: 'array', items: { $ref: '#/components/schemas/PublicEvent' } },
  TrainerProgressList: { type: 'array', items: { $ref: '#/components/schemas/TrainerProgress' } },
  Skill: { type: 'object', additionalProperties: true },
  TraineeEvent: { type: 'object', additionalProperties: true },
  SkillReview: { type: 'object', additionalProperties: true },
  EventReview: { type: 'object', additionalProperties: true },
  PublicSkill: { type: 'object', additionalProperties: true },
  PublicEvent: { type: 'object', additionalProperties: true },
  TrainerProgress: { type: 'object', additionalProperties: true },
};
