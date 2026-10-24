import { curriculumPaths, curriculumSchemas } from './curriculum-docs.js';
import { projectPaths, projectSchemas } from './project-docs.js';
import { traineePaths, traineeSchemas } from './trainee-docs.js';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Maxim Nyansa Bootcamp API',
    version: '0.5.0',
    description:
      'Bootcamp API. Implemented routes: health, sign-in, sessions, the curriculum, trainee profiles, and projects. Public lists return published rows only. A public trainee also needs profile consent. Project links are included only when every linked trainee has agreed to share them. Foundation-wide counters are a later milestone. There is no public registration.',
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
        required: ['id', 'email', 'displayName', 'initials', 'hue', 'role'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string' },
          displayName: { type: 'string' },
          initials: { type: 'string' },
          hue: { type: 'integer', minimum: 0, maximum: 359 },
          role: { type: 'string', enum: ['viewer', 'editor', 'administrator'] },
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
    },
  },
};
