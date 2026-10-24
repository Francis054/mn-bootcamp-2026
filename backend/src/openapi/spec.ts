export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Maxim Nyansa Bootcamp API',
    version: '0.1.0',
    description:
      'Foundation of the bootcamp API. The only implemented route is the health check. Any other path returns the error shape with code not_found. Draft content, accounts, and uploads are later milestones.',
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
    },
  },
} as const;
