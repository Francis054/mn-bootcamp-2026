import { groupedIds, replaceIds } from '../../shared/persistence/id-links.js';
import { BaseRepository } from '../../shared/persistence/base-repository.js';
import type { TraineeEntity } from './trainee.entity.js';

type DefaultedTraineeColumn =
  | 'slug'
  | 'cohortYear'
  | 'headline'
  | 'location'
  | 'githubUrl'
  | 'photoConsent'
  | 'contactConsent'
  | 'publicLinks'
  | 'profileReviewStatus'
  | 'profileRejectionReason'
  | 'profileSubmittedAt'
  | 'profileReviewedAt'
  | 'profileReviewedBy'
  | 'pendingDisplayName'
  | 'pendingHeadline'
  | 'pendingBio'
  | 'pendingLocation'
  | 'pendingLinkedin'
  | 'pendingGithubUrl'
  | 'pendingPortfolio'
  | 'pendingPhotoUrl'
  | 'pendingPhotoStorageKey';

export class TraineeRepository extends BaseRepository<TraineeEntity> {
  findAll(): Promise<TraineeEntity[]> {
    return this.repository.find({ order: { displayName: 'ASC', id: 'ASC' } });
  }

  findByEmail(email: string): Promise<TraineeEntity | null> {
    return this.repository.findOne({ where: { email } });
  }

  findBySlug(slug: string): Promise<TraineeEntity | null> {
    const value = slug.trim().toLowerCase();
    if (!value) return Promise.resolve(null);
    return this.repository
      .createQueryBuilder('trainee')
      .where('lower(trainee.slug) = :slug', { slug: value })
      .getOne();
  }

  countByModule(focus: string): Promise<number> {
    return this.repository.count({ where: { focus } });
  }

  async consentFlags(ids: readonly string[]): Promise<Map<string, boolean>> {
    const flags = new Map<string, boolean>();
    if (ids.length === 0) return flags;
    const rows: unknown = await this.repository.manager.query(
      'SELECT id, links_share_consent FROM trainees WHERE id = ANY($1::varchar[])',
      [ids],
    );
    if (!Array.isArray(rows)) return flags;
    for (const entry of rows) {
      const item: unknown = entry;
      if (typeof item !== 'object' || item === null) continue;
      if (!('id' in item) || !('links_share_consent' in item)) continue;
      const id: unknown = item.id;
      const consent: unknown = item.links_share_consent;
      if (typeof id !== 'string' || typeof consent !== 'boolean') continue;
      flags.set(id, consent);
    }
    return flags;
  }

  lessonIdsByTrainee(traineeIds: readonly string[]): Promise<Map<string, string[]>> {
    return groupedIds(
      (sql, params) => this.repository.manager.query(sql, params),
      'trainee_lessons',
      traineeIds,
    );
  }

  replaceLessons(traineeId: string, lessonIds: readonly string[]): Promise<void> {
    return this.repository.manager.transaction((manager) =>
      replaceIds(
        (sql, params) => manager.query(sql, params),
        'trainee_lessons',
        traineeId,
        lessonIds,
      ),
    );
  }

  insert(
    trainee: Omit<TraineeEntity, 'createdAt' | 'updatedAt' | DefaultedTraineeColumn> &
      Partial<Pick<TraineeEntity, DefaultedTraineeColumn>>,
  ): Promise<TraineeEntity> {
    const reviewStatus =
      trainee.profileReviewStatus ??
      (trainee.publicationStatus === 'published' ? 'approved' : 'draft');
    return this.repository.save(
      this.repository.create({
        slug: null,
        cohortYear: 2026,
        headline: '',
        location: '',
        githubUrl: null,
        photoConsent: false,
        contactConsent: false,
        publicLinks: false,
        profileReviewStatus: reviewStatus,
        profileRejectionReason: '',
        profileSubmittedAt: null,
        profileReviewedAt: null,
        profileReviewedBy: null,
        pendingDisplayName: null,
        pendingHeadline: null,
        pendingBio: null,
        pendingLocation: null,
        pendingLinkedin: null,
        pendingGithubUrl: null,
        pendingPortfolio: null,
        pendingPhotoUrl: null,
        pendingPhotoStorageKey: null,
        ...trainee,
      }),
    );
  }

  async remove(trainee: TraineeEntity): Promise<void> {
    await this.repository.remove(trainee);
  }
}
