import { accountPaths, accountSchemas } from './account-docs.js';
import { contentPaths, contentSchemas } from './content-docs.js';
import { curriculumPaths, curriculumSchemas } from './curriculum-docs.js';
import { eventPaths, eventSchemas } from './event-docs.js';
import { mediaPaths, mediaSchemas } from './media-docs.js';
import { siteImagePaths, siteImageSchemas } from './site-image-docs.js';
import { workPhotoPaths, workPhotoSchemas } from './work-photo-docs.js';
import { projectPaths, projectSchemas } from './project-docs.js';
import { traineePaths, traineeSchemas } from './trainee-docs.js';
import { timetablePaths, timetableSchemas } from './timetable-docs.js';
import { portalPaths, portalSchemas } from './portal-docs.js';
import { portfolioPaths, portfolioSchemas } from './portfolio-docs.js';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Maxim Nyansa Bootcamp API',
    version: '0.9.0',
    description:
      'Bootcamp API. Implemented routes: health, sign-in, sessions, password change and reset, invitations, trainee signup and email confirmation, the trainee portal, the curriculum, trainee profiles, projects, events, the gallery, work photos, the content singletons, and the contact form. Public reads return published copies. Homepage, about, the timeline, and settings each keep a draft for editors. The announcement banner is part of the homepage. Foundation counters are stored with settings and are published with them. A public gallery photo also needs verified consent. Verifying consent does not publish the photo. Work photos are uploaded by an administrator and stay off the public site until that administrator publishes them. Site image slots are the community badge, the parent-organisation plate, and the built-in page photographs. Anyone can read them. Only an administrator can replace one or put the bundled file back. A scheduled event stays off the public routes until its Africa/Accra start, and that clock is UTC. A public trainee also needs profile consent. Project links are included only when every linked trainee has agreed to share them. A password reset response does not say whether the mailbox exists. Trainee signup is roster-only: an email that is not on the cohort list is queued for an administrator, and the public response does not say which happened.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/v1/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Process and database liveness',
        responses: {
          '200': {
            description: 'The process is up and the database answered.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthReport' },
              },
            },
          },
          '503': {
            description: 'The process is up and the database did not answer.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthReport' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        operationId: 'login',
        summary: 'Start a server session',
        description:
          'Sets the HttpOnly session cookie `mn_session` on path /api/v1 and the readable CSRF cookie `mn_csrf` on path /. Neither cookie sets Domain. SameSite is Lax. Secure is set in production. developmentAck is ignored. Failures do not say whether the mailbox exists.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Signed in. The session token is only in the cookie.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          '401': {
            description: 'The email or password is not correct.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
          },
          '422': {
            description: 'The body failed validation.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
          },
          '403': {
            description:
              'The password matched a trainee account whose email is not confirmed yet. A suspended account uses the same 401 as a wrong password.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
          },
          '429': {
            description: 'Too many sign-in attempts.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
          },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        operationId: 'logout',
        summary: 'Delete the server session',
        description:
          'Requires the session cookie and a matching X-CSRF-Token header. Clears both cookies.',
        responses: {
          '204': { description: 'Signed out.' },
          '403': {
            description: 'The CSRF token does not match.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
          },
        },
      },
    },
    '/api/v1/auth/session': {
      get: {
        operationId: 'getSession',
        summary: 'Current session',
        description: 'Does not require CSRF. An anonymous caller gets authenticated: false.',
        responses: {
          '200': {
            description: 'Whether a session is active.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionResponse' },
              },
            },
          },
        },
      },
    },
    ...curriculumPaths,
    ...traineePaths,
    ...projectPaths,
    ...eventPaths,
    ...mediaPaths,
    ...workPhotoPaths,
    ...siteImagePaths,
    ...contentPaths,
    ...accountPaths,
    ...timetablePaths,
    ...portalPaths,
    ...portfolioPaths,
  },
  components: {
    schemas: {
      HealthReport: {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'database', 'uptimeSeconds'],
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          database: { type: 'string', enum: ['up', 'down'] },
          uptimeSeconds: { type: 'integer', minimum: 0 },
        },
      },
      LoginRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 200 },
          developmentAck: { type: 'boolean', description: 'Ignored. Sent by the current website.' },
        },
      },
      PublicUser: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'email', 'displayName', 'initials', 'hue', 'role', 'emailVerified', 'traineeId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string' },
          displayName: { type: 'string' },
          initials: { type: 'string' },
          hue: { type: 'integer', minimum: 0, maximum: 359 },
          role: {
            type: 'string',
            enum: ['trainee', 'trainer', 'viewer', 'editor', 'administrator'],
          },
          emailVerified: { type: 'boolean' },
          traineeId: { type: 'string', nullable: true },
        },
      },
      LoginResponse: {
        type: 'object',
        additionalProperties: false,
        required: ['user', 'expiresAt'],
        properties: {
          user: { $ref: '#/components/schemas/PublicUser' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      SessionResponse: {
        type: 'object',
        additionalProperties: false,
        required: ['authenticated'],
        properties: {
          authenticated: { type: 'boolean' },
          user: { $ref: '#/components/schemas/PublicUser' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      ErrorBody: {
        type: 'object',
        additionalProperties: false,
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: [
                  'validation',
                  'unauthenticated',
                  'forbidden',
                  'not_found',
                  'rate_limited',
                  'server',
                  'pending',
                ],
              },
              message: { type: 'string' },
              fieldErrors: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
            },
          },
        },
      },
      ...curriculumSchemas,
      ...traineeSchemas,
      ...projectSchemas,
      ...eventSchemas,
      ...mediaSchemas,
      ...workPhotoSchemas,
      ...siteImageSchemas,
      ...contentSchemas,
      ...accountSchemas,
      ...timetableSchemas,
      ...portalSchemas,
      ...portfolioSchemas,
    },
  },
};
