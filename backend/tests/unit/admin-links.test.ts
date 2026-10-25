import { describe, expect, it } from 'vitest';
import { EventCreateDto } from '../../src/modules/events/event.dto.js';
import { ProjectCreateDto } from '../../src/modules/projects/project.dto.js';
import { TraineeCreateDto } from '../../src/modules/trainees/trainee.dto.js';
import { validateDto } from '../../src/shared/validation/validate-dto.js';

const TRAINEE_BODY = {
  displayName: 'Sample Trainee',
  email: 'sample@example.com',
  track: 'Blue team',
  focus: 'network',
  linkedin: '',
  portfolio: null,
};

const PROJECT_BODY = {
  title: 'Lab walkthrough',
  type: 'Lab',
  abstract: 'This abstract is long enough to describe the work.',
  moduleId: 'network',
  repositoryUrl: '',
  demoUrl: 'https://example.com/demo',
};

const EVENT_BODY = {
  title: 'Opening day',
  place: 'Venue to be confirmed',
  summary: 'This summary is long enough for the card.',
  dateTbc: true,
  startTime: '',
  endTime: '',
  verified: false,
  sourceUrl: '',
};

describe('admin relation ids', () => {
  it('accepts the bodies the forms send, including blank links', async () => {
    await expect(
      validateDto(TraineeCreateDto, { ...TRAINEE_BODY, lessonIds: [] }),
    ).resolves.toMatchObject({
      lessonIds: [],
      linkedin: null,
    });
    await expect(
      validateDto(ProjectCreateDto, { ...PROJECT_BODY, traineeIds: [], lessonIds: [] }),
    ).resolves.toMatchObject({
      repositoryUrl: '',
      lessonIds: [],
    });
    await expect(
      validateDto(EventCreateDto, { ...EVENT_BODY, lessonIds: [], projectIds: [], mediaIds: [] }),
    ).resolves.toMatchObject({
      lessonIds: [],
      sourceUrl: '',
    });
  });

  it('names the relation when an id is not an id', async () => {
    await expect(
      validateDto(TraineeCreateDto, { ...TRAINEE_BODY, lessonIds: ['not an id'] }),
    ).rejects.toMatchObject({
      fieldErrors: { lessonIds: 'Choose a class.' },
    });
    await expect(
      validateDto(ProjectCreateDto, { ...PROJECT_BODY, lessonIds: ['bad id'] }),
    ).rejects.toMatchObject({
      fieldErrors: { lessonIds: 'Choose a class.' },
    });
    await expect(
      validateDto(EventCreateDto, {
        ...EVENT_BODY,
        projectIds: ['bad id'],
        mediaIds: ['also bad'],
      }),
    ).rejects.toMatchObject({
      fieldErrors: { projectIds: 'Choose a project.' },
    });
  });

  it('rejects an http project link with the form sentence', async () => {
    await expect(
      validateDto(ProjectCreateDto, { ...PROJECT_BODY, repositoryUrl: 'http://example.com/repo' }),
    ).rejects.toMatchObject({
      fieldErrors: { repositoryUrl: 'Enter a full link starting with https://.' },
    });
  });
});
