import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'cv_requests' })
export class CvRequestEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ name: 'from_name', type: 'varchar', length: 120 })
  fromName!: string;

  @Column({ name: 'from_org', type: 'varchar', length: 160 })
  fromOrg!: string;

  @Column({ name: 'from_email', type: 'varchar', length: 320 })
  fromEmail!: string;

  @Column({ type: 'varchar', length: 2000 })
  message!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: 'new' | 'sent' | 'blocked' | 'failed';

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'ip_hash', type: 'varchar', length: 64 })
  ipHash!: string;
}
