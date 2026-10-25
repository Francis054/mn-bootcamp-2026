const ok = (operationId: string, summary: string, description?: string) => ({
  operationId,
  summary,
  ...(description ? { description } : {}),
  responses: { '200': { description: summary } },
});

const write = (
  operationId: string,
  summary: string,
  status = '200',
) => ({
  operationId,
  summary,
  description:
    'Requires content.write. A viewer can read the timetable and cannot change it.',
  responses: { [status]: { description: summary } },
});

export const timetablePaths = {
  '/api/v1/public/timetable': {
    get: ok(
      'getPublicTimetable',
      'Published timetable',
      'The 12-week programme, blocks, weeks, deliverables and daily sessions. Trainer names are the proposed names from the workbook. Responses use the public cache.',
    ),
  },
  '/api/v1/public/blocks': { get: ok('listPublicBlocks', 'Timetable blocks') },
  '/api/v1/public/weeks': { get: ok('listPublicWeeks', 'Timetable weeks') },
  '/api/v1/public/weeks/{number}': { get: ok('getPublicWeek', 'One timetable week') },
  '/api/v1/public/sessions': {
    get: ok('listPublicSessions', 'Timetable sessions', 'Optional query week is a week number or week id.'),
  },
  '/api/v1/public/deliverables': { get: ok('listPublicDeliverables', 'Weekly deliverables') },
  '/api/v1/admin/timetable': {
    get: ok('getAdminTimetable', 'Admin timetable', 'Requires content.read. Includes import warnings.'),
  },
  '/api/v1/admin/timetable/import': {
    post: write(
      'importTimetable',
      'Re-import an xlsx workbook. Running it again updates the same rows.',
    ),
  },
  '/api/v1/admin/blocks': {
    get: ok('listAdminBlocks', 'Admin blocks'),
    post: write('createBlock', 'Create a block', '201'),
  },
  '/api/v1/admin/blocks/{id}': {
    patch: write('updateBlock', 'Update a block'),
    delete: write('deleteBlock', 'Delete a block'),
  },
  '/api/v1/admin/weeks': {
    get: ok('listAdminWeeks', 'Admin weeks'),
    post: write('createWeek', 'Create a week', '201'),
  },
  '/api/v1/admin/weeks/{id}': {
    get: ok('getAdminWeek', 'One admin week'),
    patch: write('updateWeek', 'Update a week, its deliverables, or its trainers'),
    delete: write('deleteWeek', 'Delete a week'),
  },
  '/api/v1/admin/weeks/{id}/deliverables': {
    put: write('replaceWeekDeliverables', 'Replace the deliverables for a week'),
  },
  '/api/v1/admin/weeks/{id}/trainers': {
    put: write('replaceWeekTrainers', 'Replace the proposed trainers for a week'),
  },
  '/api/v1/admin/sessions': {
    get: ok(
      'listAdminSessions',
      'Filter sessions by week, block, date, trainer, type or text',
    ),
    post: write('createSession', 'Add a session', '201'),
  },
  '/api/v1/admin/sessions/reorder': {
    post: write('reorderSession', 'Move a session earlier or later on the same day'),
  },
  '/api/v1/admin/sessions/{id}': {
    get: ok('getAdminSession', 'One session'),
    patch: write('updateSession', 'Update a session'),
    delete: write('deleteSession', 'Delete a session'),
  },
  '/api/v1/admin/trainers': { get: ok('listAdminTrainers', 'Proposed trainers') },
  '/api/v1/admin/trainers/{id}': {
    patch: write('updateTrainer', 'Rename a trainer or clear the proposed flag'),
    delete: write('deleteTrainer', 'Delete an unused trainer'),
  },
};

export const timetableSchemas = {};
