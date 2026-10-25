import { Router, type Request } from 'express';
import { requirePermission } from '../auth/require-auth.js';
import type { Actor } from '../curriculum/actor.js';
import { validateDto } from '../../shared/validation/validate-dto.js';
import {
  BlockWriteDto,
  ReorderSessionDto,
  SessionWriteDto,
  TrainerPatchDto,
  WeekPatchDto,
  WeekWriteDto,
} from './timetable.dto.js';
import type { TimetableService } from './timetable.service.js';
import { readWorkbookUpload } from './upload.js';

export function mountPublicTimetable(router: Router, timetable: TimetableService): void {
  router.get('/public/timetable', (_req, res, next) => {
    timetable
      .publicTimetable()
      .then((body) => res.json(body))
      .catch(next);
  });
  router.get('/public/blocks', (_req, res, next) => {
    timetable
      .publicTimetable()
      .then((body) => res.json(body.blocks))
      .catch(next);
  });
  router.get('/public/weeks', (_req, res, next) => {
    timetable
      .publicTimetable()
      .then((body) => res.json(body.blocks.flatMap((block) => block.weeks)))
      .catch(next);
  });
  router.get('/public/weeks/:number', (req, res, next) => {
    const number = Number(param(req, 'number'));
    timetable
      .publicTimetable()
      .then((body) => {
        const week = body.blocks.flatMap((block) => block.weeks).find((item) => item.number === number);
        if (!week) {
          res.status(404).json({ error: { code: 'not_found', message: 'That week is not on the timetable.' } });
          return;
        }
        res.json(week);
      })
      .catch(next);
  });
  router.get('/public/sessions', (req, res, next) => {
    const week = textQuery(req, 'week');
    timetable
      .publicTimetable()
      .then((body) => {
        const sessions = body.blocks
          .flatMap((block) => block.weeks)
          .filter((item) => !week || String(item.number) === week || item.id === week)
          .flatMap((item) => item.sessions);
        res.json(sessions);
      })
      .catch(next);
  });
  router.get('/public/deliverables', (_req, res, next) => {
    timetable
      .publicTimetable()
      .then((body) =>
        res.json(
          body.blocks.flatMap((block) =>
            block.weeks.flatMap((week) =>
              week.deliverables.map((item) => ({ ...item, weekId: week.id, week: week.number })),
            ),
          ),
        ),
      )
      .catch(next);
  });
}

export function mountAdminTimetable(admin: Router, timetable: TimetableService): void {
  admin.get('/timetable', (_req, res, next) => {
    timetable
      .adminTimetable()
      .then((body) => res.json(body))
      .catch(next);
  });
  admin.post('/timetable/import', requirePermission('content.write'), (req, res, next) => {
    readWorkbookUpload(req)
      .then((buffer) => timetable.importBuffer(buffer, actorFrom(req)))
      .then((body) => res.json(body))
      .catch(next);
  });

  admin.get('/blocks', (_req, res, next) => {
    timetable
      .adminTimetable()
      .then((body) => res.json(body.blocks))
      .catch(next);
  });
  admin.post('/blocks', requirePermission('content.write'), (req, res, next) => {
    validateDto(BlockWriteDto, req.body)
      .then((dto) => timetable.createBlock(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.patch('/blocks/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(BlockWriteDto, req.body)
      .then((dto) => timetable.updateBlock(param(req, 'id'), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/blocks/:id', requirePermission('content.write'), (req, res, next) => {
    timetable
      .deleteBlock(param(req, 'id'), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });

  admin.get('/weeks', (_req, res, next) => {
    timetable
      .adminTimetable()
      .then((body) => res.json(body.blocks.flatMap((block) => block.weeks)))
      .catch(next);
  });
  admin.post('/weeks', requirePermission('content.write'), (req, res, next) => {
    validateDto(WeekWriteDto, req.body)
      .then((dto) => timetable.createWeek(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.get('/weeks/:id', (req, res, next) => {
    timetable
      .adminTimetable()
      .then((body) => {
        const week = body.blocks.flatMap((block) => block.weeks).find((item) => item.id === param(req, 'id'));
        if (!week) {
          res.status(404).json({ error: { code: 'not_found', message: 'That week was not found.' } });
          return;
        }
        res.json(week);
      })
      .catch(next);
  });
  admin.patch('/weeks/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(WeekPatchDto, req.body)
      .then((dto) => timetable.updateWeek(param(req, 'id'), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/weeks/:id', requirePermission('content.write'), (req, res, next) => {
    timetable
      .deleteWeek(param(req, 'id'), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.put('/weeks/:id/deliverables', requirePermission('content.write'), (req, res, next) => {
    validateDto(WeekPatchDto, { deliverables: jsonField(req.body, 'deliverables') })
      .then((dto) => timetable.updateWeek(param(req, 'id'), { deliverables: dto.deliverables ?? [] }, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.put('/weeks/:id/trainers', requirePermission('content.write'), (req, res, next) => {
    validateDto(WeekPatchDto, req.body)
      .then((dto) =>
        timetable.updateWeek(
          param(req, 'id'),
          {
            ...(dto.professionalismTrainerIds !== undefined
              ? { professionalismTrainerIds: dto.professionalismTrainerIds }
              : {}),
            ...(dto.cybersecurityTrainerIds !== undefined
              ? { cybersecurityTrainerIds: dto.cybersecurityTrainerIds }
              : {}),
          },
          actorFrom(req),
        ),
      )
      .then((row) => res.json(row))
      .catch(next);
  });

  admin.get('/sessions', (req, res, next) => {
    timetable
      .listSessions({
        ...(textQuery(req, 'weekId') ? { weekId: textQuery(req, 'weekId') } : {}),
        ...(textQuery(req, 'blockId') ? { blockId: textQuery(req, 'blockId') } : {}),
        ...(textQuery(req, 'date') ? { date: textQuery(req, 'date') } : {}),
        ...(textQuery(req, 'trainerId') ? { trainerId: textQuery(req, 'trainerId') } : {}),
        ...(textQuery(req, 'type') ? { type: textQuery(req, 'type') } : {}),
        ...(textQuery(req, 'q') ? { q: textQuery(req, 'q') } : {}),
      })
      .then((rows) => res.json({ items: rows }))
      .catch(next);
  });
  admin.post('/sessions', requirePermission('content.write'), (req, res, next) => {
    validateDto(SessionWriteDto, req.body)
      .then((dto) => timetable.createSession(dto, actorFrom(req)))
      .then((row) => res.status(201).json(row))
      .catch(next);
  });
  admin.post('/sessions/reorder', requirePermission('content.write'), (req, res, next) => {
    validateDto(ReorderSessionDto, req.body)
      .then((dto) => timetable.reorderSession(dto.id, dto.direction, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.get('/sessions/:id', (req, res, next) => {
    timetable
      .listSessions({})
      .then((rows) => {
        const row = rows.find((item) => item.id === param(req, 'id'));
        if (!row) {
          res.status(404).json({ error: { code: 'not_found', message: 'That session was not found.' } });
          return;
        }
        res.json(row);
      })
      .catch(next);
  });
  admin.patch('/sessions/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(SessionWriteDto, req.body)
      .then((dto) => timetable.updateSession(param(req, 'id'), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/sessions/:id', requirePermission('content.write'), (req, res, next) => {
    timetable
      .deleteSession(param(req, 'id'), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });

  admin.get('/trainers', (_req, res, next) => {
    timetable
      .adminTimetable()
      .then((body) => res.json(body.trainers))
      .catch(next);
  });
  admin.patch('/trainers/:id', requirePermission('content.write'), (req, res, next) => {
    validateDto(TrainerPatchDto, req.body)
      .then((dto) => timetable.updateTrainer(param(req, 'id'), dto, actorFrom(req)))
      .then((row) => res.json(row))
      .catch(next);
  });
  admin.delete('/trainers/:id', requirePermission('content.write'), (req, res, next) => {
    timetable
      .deleteTrainer(param(req, 'id'), actorFrom(req))
      .then((row) => res.json(row))
      .catch(next);
  });
}

function actorFrom(req: Request): Actor {
  return {
    userId: req.user?.id ?? null,
    ip: req.ip ?? null,
    requestId: req.id,
  };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
}

function textQuery(req: Request, name: string): string {
  const value = req.query[name];
  return typeof value === 'string' ? value : '';
}

function jsonField(body: unknown, key: string): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  const record = Object.fromEntries(Object.entries(body));
  return record[key];
}
