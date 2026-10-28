import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { curriculumRouter } from '../../src/modules/curriculum/curriculum.routes.js';
import type { SessionService } from '../../src/modules/auth/session.service.js';
import type { TimetableService } from '../../src/modules/timetable/timetable.service.js';
import { errorHandler } from '../../src/shared/errors/error-handler.js';
import { readError, readRecord } from '../support/read-json.js';
import { pino } from 'pino';

const publicBody = {
  programme: {
    id: 'bootcamp-2026',
    name: 'Cybersecurity Bootcamp',
    startsOn: '2026-10-05',
    endsOn: '2026-12-25',
    rules: ['Devotion: 8–8:30 a.m.'],
  },
  today: '2026-10-24',
  currentWeek: 3,
  blocks: [
    {
      id: 'block-1',
      sortOrder: 1,
      name: 'Foundations & Secure Systems',
      professionalismTheme: 'Professional Foundation',
      cybersecurityTheme: 'Cybersecurity Foundations',
      weeks: [
        {
          id: 'week-01',
          number: 1,
          title: 'Foundations and professional orientation',
          startsOn: '2026-10-05',
          professionalism: 'Kick-off',
          cybersecurity: 'CIA triad',
          deliverables: [{ id: 'del-01-01', sortOrder: 1, title: 'Personal learning plan' }],
          professionalismTrainers: [],
          cybersecurityTrainers: [],
          sessions: [],
        },
      ],
    },
  ],
  trainers: [],
};

function appFor(role: 'editor' | 'viewer' | null) {
  const sessions = {
    authenticate: (token: string) => {
      if (!role || token !== role) return Promise.resolve(null);
      return Promise.resolve({
        sessionId: 'session-1',
        user: {
          id: 'user-1',
          email: `${role}@example.test`,
          displayName: role,
          initials: 'TT',
          hue: 1,
          role,
        },
      });
    },
  } as unknown as SessionService;
  const timetable = {
    publicTimetable: () => Promise.resolve(publicBody),
    adminTimetable: () => Promise.resolve({ ...publicBody, sourceNote: '', warnings: [], sessions: [], trainers: [] }),
    listSessions: () => Promise.resolve([]),
    createSession: () => Promise.resolve({ id: 'sess-new' }),
    updateWeek: () => Promise.resolve({ id: 'week-01' }),
  } as unknown as TimetableService;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    '/api/v1',
    curriculumRouter(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      1024,
      {} as never,
      sessions,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      timetable,
      {} as never,
    ),
  );
  app.use(errorHandler(pino({ level: 'silent' }), { nodeEnv: 'test' } as never));
  return app;
}

describe('timetable API', () => {
  it('returns the public timetable without a session', async () => {
    const response = await request(appFor(null)).get('/api/v1/public/timetable').expect(200);
    const programme = readRecord(readRecord(response.body).programme);
    expect(programme.startsOn).toBe('2026-10-05');
    expect(programme.endsOn).toBe('2026-12-25');
    const blocks = readRecord(response.body).blocks;
    expect(Array.isArray(blocks) && readRecord(blocks[0]).name).toBe('Foundations & Secure Systems');
    const week = await request(appFor(null)).get('/api/v1/public/weeks/1').expect(200);
    const deliverables = readRecord(week.body).deliverables;
    expect(Array.isArray(deliverables) && readRecord(deliverables[0]).title).toBe('Personal learning plan');
    await request(appFor(null)).get('/api/v1/public/weeks/99').expect(404);
  });

  it('refuses anonymous and read-only writes, and validates a session body', async () => {
    await request(appFor(null)).get('/api/v1/admin/timetable').expect(401);
    await request(appFor('viewer'))
      .post('/api/v1/admin/sessions')
      .set('Cookie', 'mn_session=viewer')
      .send({ weekId: 'week-01', date: '2026-10-06', type: 'theory', activity: 'Technical theory', topic: 'CIA', trainerIds: [] })
      .expect(403);
    const invalid = await request(appFor('editor'))
      .post('/api/v1/admin/sessions')
      .set('Cookie', 'mn_session=editor')
      .send({ weekId: 'week-01', topic: 'Missing the rest' })
      .expect(422);
    expect(readError(invalid.body).code).toBe('validation');
    const created = await request(appFor('editor'))
      .post('/api/v1/admin/sessions')
      .set('Cookie', 'mn_session=editor')
      .send({
        weekId: 'week-01',
        date: '2026-10-06',
        type: 'theory',
        activity: 'Technical theory',
        topic: 'CIA triad',
        startTime: '08:45',
        endTime: '10:20',
        trainerIds: [],
      })
      .expect(201);
    expect(readRecord(created.body).id).toBe('sess-new');
  });
});
