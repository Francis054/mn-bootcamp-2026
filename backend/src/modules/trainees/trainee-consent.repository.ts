import type { Repository } from 'typeorm';
import type { ConsentScope, ConsentSource, TraineeConsentEntity } from './trainee-consent.entity.js';

export interface NewConsent {
  traineeId: string;
  scope: ConsentScope;
  granted: boolean;
  source: ConsentSource;
  policyVersion: string;
  wording: string;
  recordedBy: string | null;
}

export class TraineeConsentRepository {
  constructor(private readonly repository: Repository<TraineeConsentEntity>) {}

  async record(input: NewConsent): Promise<TraineeConsentEntity> {
    return this.repository.save(this.repository.create(input));
  }

  forTrainee(traineeId: string): Promise<TraineeConsentEntity[]> {
    return this.repository.find({
      where: { traineeId },
      order: { createdAt: 'DESC' },
    });
  }
}
