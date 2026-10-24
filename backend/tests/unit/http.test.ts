import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { HealthService } from '../../src/modules/health/health.service.js';
import { testEnv } from '../support/app-env.js';
import { captureLogger } from '../support/logger.js';
import { readError, readRecord } from '../support/read-json.js';

function appWith(options?: {
  rateLimitMax?: number;
  nodeEnv?: 'development' | 'test' | 'production';
  health?: HealthService;
  lines?: () => string[];
}) {
  const captured = captureLogger();
  const health =
    options?.health ??
    new HealthService({ query: () => Promise.resolve([{ ok: 1 }]) }, captured.logger);
  const app = createApp({
    env: testEnv({
      rateLimitMax: options?.rateLimitMax ?? 10_000,
      ...(options?.nodeEnv ? { nodeEnv: options.nodeEnv } : {}),
    }),
    logger: captured.logger,
    health,
    authRouter: Router(),
    curriculumRouter: Router(),
  });
  return { app, lines: options?.lines ?? captured.lines };
}

describe('HTTP pipeline', () => {
  it('answers the health check and echoes a safe request id', async () => {
    const { app } = appWith();
    const response = await request(app)
      .get('/api/v1/health')
      .set('X-Request-Id', 'request-1')
      .expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(response.headers['x-request-id']).toBe('request-1');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns 503 when the database probe fails, without the driver text', async () => {
    const captured = captureLogger();
    const health = new HealthService(
      { query: () => Promise.reject(new Error('password=secret-password')) },
      captured.logger,
    );
    const { app } = appWith({ health });
    const response = await request(app).get('/api/v1/health').expect(503);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'down' });
    expect(JSON.stringify(response.body)).not.toContain('secret-password');
  });

  it('uses the error shape for an unknown route', async () => {
    const { app } = appWith();
    const response = await request(app).get('/api/v1/lessons').expect(404);
    expect(response.body).toEqual({
      error: { code: 'not_found', message: 'That route does not exist.' },
    });
  });

  it('hides unexpected exceptions behind a server error', async () => {
    const captured = captureLogger();
    const health = {
      check: () => Promise.reject(new Error('postgres://app:secret-password@db/prod')),
    } as unknown as HealthService;
    const app = createApp({
      env: testEnv(),
      logger: captured.logger,
      health,
      authRouter: Router(),
      curriculumRouter: Router(),
    });
    const response = await request(app).get('/api/v1/health').expect(500);
    expect(response.body).toEqual({
      error: { code: 'server', message: 'Something went wrong.' },
    });
    expect(JSON.stringify(response.body)).not.toContain('secret-password');
    expect(captured.lines().join('')).not.toContain('secret-password');
  });

  it('treats invalid and oversized JSON as validation errors', async () => {
    const { app } = appWith();
    const invalid = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(422);
    expect(readError(invalid.body).code).toBe('validation');

    const oversized = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send({ blob: 'x'.repeat(1_100_000) })
      .expect(422);
    expect(readError(oversized.body)).toEqual({
      code: 'validation',
      message: 'The request body is too large.',
    });
    expect(JSON.stringify(oversized.body)).not.toContain('xxxx');
  });

  it('allows only the configured origin and does not use a wildcard', async () => {
    const { app } = appWith();
    const allowed = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://127.0.0.1:5173')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const rejected = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(readError(rejected.body).code).toBe('forbidden');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate limits repeated calls and still lets health checks through', async () => {
    const { app } = appWith({ rateLimitMax: 2 });
    await request(app).get('/api/v1/missing').expect(404);
    await request(app).get('/api/v1/missing').expect(404);
    const limited = await request(app).get('/api/v1/missing').expect(429);
    expect(limited.body).toEqual({
      error: { code: 'rate_limited', message: 'Too many requests. Try again later.' },
    });
    await request(app).get('/api/v1/health').expect(200);
  });

  it('logs the path and status without the query string', async () => {
    const { app, lines } = appWith();
    await request(app).get('/api/v1/health?token=super-secret-token').expect(200);
    const written = lines().join('');
    expect(written).toContain('"path":"/api/v1/health"');
    expect(written).toContain('"status":200');
    expect(written).not.toContain('super-secret-token');
  });

  it('serves the OpenAPI document and stores the cookie policy on the app', async () => {
    const { app } = appWith({ nodeEnv: 'production' });
    const spec = await request(app).get('/api/docs/openapi.json').expect(200);
    const document = readRecord(spec.body);
    const paths = readRecord(document.paths);
    const healthPath = readRecord(paths['/api/v1/health']);
    const healthGet = readRecord(healthPath.get);
    expect(healthGet.operationId).toBe('getHealth');
    const loginPath = readRecord(paths['/api/v1/auth/login']);
    const loginPost = readRecord(loginPath.post);
    expect(loginPost.operationId).toBe('login');
    const classesPath = readRecord(paths['/api/v1/public/classes']);
    const classesGet = readRecord(classesPath.get);
    expect(classesGet.operationId).toBe('listPublicClasses');
    const traineesPath = readRecord(paths['/api/v1/public/trainees']);
    const traineesGet = readRecord(traineesPath.get);
    expect(traineesGet.operationId).toBe('listPublicTrainees');
    const projectsPath = readRecord(paths['/api/v1/public/projects']);
    const projectsGet = readRecord(projectsPath.get);
    expect(projectsGet.operationId).toBe('listPublicProjects');
    const eventsPath = readRecord(paths['/api/v1/public/events']);
    const eventsGet = readRecord(eventsPath.get);
    expect(eventsGet.operationId).toBe('listPublicEvents');
    const mediaPath = readRecord(paths['/api/v1/public/media']);
    const mediaGet = readRecord(mediaPath.get);
    expect(mediaGet.operationId).toBe('listPublicMedia');
    const homePath = readRecord(paths['/api/v1/public/home']);
    const homeGet = readRecord(homePath.get);
    expect(homeGet.operationId).toBe('getPublicHome');
    const info = readRecord(document.info);
    expect(info.version).toBe('0.9.0');
    const resetPath = readRecord(paths['/api/v1/auth/password-reset/request']);
    const resetPost = readRecord(resetPath.post);
    expect(resetPost.operationId).toBe('requestPasswordReset');
    const enquiryPath = readRecord(paths['/api/v1/public/enquiries']);
    const enquiryPost = readRecord(enquiryPath.post);
    expect(enquiryPost.operationId).toBe('createEnquiry');
    const components = readRecord(document.components);
    const schemas = readRecord(components.schemas);
    expect(schemas.ErrorBody).toBeDefined();
    const docs = await request(app).get('/api/docs/').expect(200);
    expect(docs.text).toContain('Swagger');
    expect(app.locals.cookiePolicy.session).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1',
    });
    expect(app.locals.cookiePolicy.csrf.path).toBe('/');
    expect(app.locals.cookiePolicy.session).not.toHaveProperty('domain');
  });
});
