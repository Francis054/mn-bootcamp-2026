import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { PRIVATE_CACHE_CONTROL, PUBLIC_GET_CACHE_CONTROL } from '../../src/shared/http/cache-control.js';
import { PUBLIC_READ_RATE_LIMIT_MAX, readRateLimitMax } from '../../src/shared/http/rate-limit.js';
import { HealthService } from '../../src/modules/health/health.service.js';
import { testEnv } from '../support/app-env.js';
import { captureLogger } from '../support/logger.js';
import { readError, readRecord } from '../support/read-json.js';

function appWith(options?: {
  rateLimitMax?: number;
  nodeEnv?: 'development' | 'test' | 'production';
  trustProxy?: boolean;
  health?: HealthService;
  lines?: () => string[];
  authRouter?: Router;
  curriculumRouter?: Router;
}) {
  const captured = captureLogger();
  const health =
    options?.health ??
    new HealthService({ query: () => Promise.resolve([{ ok: 1 }]) }, captured.logger);
  const app = createApp({
    env: testEnv({
      rateLimitMax: options?.rateLimitMax ?? 10_000,
      ...(options?.nodeEnv ? { nodeEnv: options.nodeEnv } : {}),
      ...(options?.trustProxy ? { trustProxy: true } : {}),
    }),
    logger: captured.logger,
    health,
    authRouter: options?.authRouter ?? Router(),
    curriculumRouter: options?.curriculumRouter ?? Router(),
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

  it('rate limits repeated writes and still lets health checks through', async () => {
    const { app } = appWith({ rateLimitMax: 2 });
    await request(app).post('/api/v1/missing').expect(404);
    await request(app).post('/api/v1/missing').expect(404);
    const limited = await request(app).post('/api/v1/missing').expect(429);
    expect(limited.body).toEqual({
      error: { code: 'rate_limited', message: 'Too many requests. Try again later.' },
    });
    await request(app).get('/api/v1/health').expect(200);
    await request(app).get('/api/v1/missing').expect(404);
  });

  it('gives page reads and the session check their own generous ceiling', async () => {
    expect(PUBLIC_READ_RATE_LIMIT_MAX).toBe(600);
    expect(readRateLimitMax(300)).toBe(600);
    expect(readRateLimitMax(10_000)).toBe(10_000);
    const auth = Router();
    auth.get('/session', (_req, res) => {
      res.json({ authenticated: false });
    });
    const curriculum = Router();
    curriculum.get('/public/home', (_req, res) => {
      res.json({ headline: 'Hello' });
    });
    const { app } = appWith({ rateLimitMax: 2, authRouter: auth, curriculumRouter: curriculum });
    for (let count = 0; count < 8; count += 1) {
      await request(app).get('/api/v1/public/home').expect(200);
      await request(app).get('/api/v1/auth/session').expect(200);
    }
  });

  it('counts each visitor separately when one proxy hop is trusted', async () => {
    const { app } = appWith({ rateLimitMax: 1, trustProxy: true });
    await request(app).post('/api/v1/missing').set('X-Forwarded-For', '203.0.113.5').expect(404);
    const firstVisitor = await request(app).post('/api/v1/missing').set('X-Forwarded-For', '203.0.113.5').expect(429);
    expect(readError(firstVisitor.body).code).toBe('rate_limited');
    await request(app).post('/api/v1/missing').set('X-Forwarded-For', '203.0.113.9').expect(404);
    await request(app).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.5').expect(200);
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

  it('caches successful public reads briefly and still answers 304', async () => {
    const curriculum = Router();
    curriculum.get('/public/home', (_req, res) => {
      res.json({ headline: 'Hello' });
    });
    curriculum.get('/public/classes/:id', (req, res) => {
      res.json({ id: req.params.id, title: 'Packets' });
    });
    const { app } = appWith({ curriculumRouter: curriculum });
    const first = await request(app).get('/api/v1/public/home').expect(200);
    expect(first.headers['cache-control']).toBe(PUBLIC_GET_CACHE_CONTROL);
    expect(first.headers.etag).toEqual(expect.any(String));
    const cached = await request(app)
      .get('/api/v1/public/home')
      .set('If-None-Match', String(first.headers.etag))
      .expect(304);
    expect(cached.headers.etag).toBe(first.headers.etag);
    expect(cached.headers['cache-control']).toBe(PUBLIC_GET_CACHE_CONTROL);

    const detail = await request(app).get('/api/v1/public/classes/week-1').expect(200);
    expect(detail.headers['cache-control']).toBe(PUBLIC_GET_CACHE_CONTROL);
    const missing = await request(app).get('/api/v1/public/missing').expect(404);
    expect(missing.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL);
  });

  it('refuses to store admin, sign-in, and public writes', async () => {
    const auth = Router();
    auth.get('/session', (_req, res) => {
      res.json({ authenticated: false });
    });
    const curriculum = Router();
    curriculum.get('/admin/home', (_req, res) => {
      res.json({ headline: 'Draft' });
    });
    curriculum.post('/admin/home/publish', (_req, res) => {
      res.json({ headline: 'Draft' });
    });
    curriculum.post('/public/enquiries', (_req, res) => {
      res.status(201).json({ delivered: true });
    });
    const { app } = appWith({ authRouter: auth, curriculumRouter: curriculum });
    const session = await request(app).get('/api/v1/auth/session').expect(200);
    expect(session.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL);
    const draft = await request(app).get('/api/v1/admin/home').expect(200);
    expect(draft.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL);
    const published = await request(app).post('/api/v1/admin/home/publish').expect(200);
    expect(published.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL);
    const enquiry = await request(app).post('/api/v1/public/enquiries').send({}).expect(201);
    expect(enquiry.headers['cache-control']).toBe(PRIVATE_CACHE_CONTROL);
  });

  it('does not let public reads use up the sign-in and write limit', async () => {
    const auth = Router();
    auth.post('/login', (_req, res) => {
      res.status(401).json({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } });
    });
    const curriculum = Router();
    curriculum.get('/public/home', (_req, res) => {
      res.json({ headline: 'Hello' });
    });
    curriculum.post('/admin/home/publish', (_req, res) => {
      res.json({ ok: true });
    });
    curriculum.post('/public/enquiries', (_req, res) => {
      res.status(201).json({ delivered: true });
    });
    const { app } = appWith({
      rateLimitMax: 2,
      authRouter: auth,
      curriculumRouter: curriculum,
    });
    await request(app).get('/api/v1/public/home').expect(200);
    await request(app).get('/api/v1/public/home').expect(200);
    await request(app).get('/api/v1/public/home').expect(200);
    await request(app).post('/api/v1/auth/login').send({}).expect(401);
    await request(app).post('/api/v1/auth/login').send({}).expect(401);
    const locked = await request(app).post('/api/v1/auth/login').send({}).expect(429);
    expect(readError(locked.body).code).toBe('rate_limited');

    const adminApp = appWith({ rateLimitMax: 2, curriculumRouter: curriculum });
    await request(adminApp.app).post('/api/v1/admin/home/publish').expect(200);
    await request(adminApp.app).post('/api/v1/admin/home/publish').expect(200);
    await request(adminApp.app).post('/api/v1/admin/home/publish').expect(429);

    const enquiryRouter = Router();
    enquiryRouter.post('/public/enquiries', (_req, res) => {
      res.status(201).json({ delivered: true });
    });
    const enquiries = appWith({ rateLimitMax: 2, curriculumRouter: enquiryRouter });
    await request(enquiries.app).post('/api/v1/public/enquiries').send({}).expect(201);
    await request(enquiries.app).post('/api/v1/public/enquiries').send({}).expect(201);
    await request(enquiries.app).post('/api/v1/public/enquiries').send({}).expect(429);

    const resetRouter = Router();
    resetRouter.post('/password-reset/request', (_req, res) => {
      res.status(202).json({ sent: true });
    });
    const reset = appWith({ rateLimitMax: 2, authRouter: resetRouter });
    await request(reset.app).post('/api/v1/auth/password-reset/request').send({}).expect(202);
    await request(reset.app).post('/api/v1/auth/password-reset/request').send({}).expect(202);
    await request(reset.app).post('/api/v1/auth/password-reset/request').send({}).expect(429);
  });
});
