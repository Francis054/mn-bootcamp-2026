import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ConsentScope = 'public_profile' | 'public_photo' | 'contact_relay';
export type ConsentSource = 'self' | 'admin';

/** One row each time a trainee or an administrator changes a consent item. */
@Entity({ name: 'trainee_consents' })
export class TraineeConsentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ type: 'varchar', length: 24 })
  scope!: ConsentScope;

  @Column({ type: 'boolean' })
  granted!: boolean;

  @Column({ type: 'varchar', length: 12 })
  source!: ConsentSource;

  @Column({ name: 'policy_version', type: 'varchar', length: 32 })
  policyVersion!: string;

  @Column({ type: 'text' })
  wording!: string;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
