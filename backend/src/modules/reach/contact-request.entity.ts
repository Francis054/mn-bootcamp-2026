import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'contact_requests' })
export class ContactRequestEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ name: 'from_name', type: 'varchar', length: 120 })
  fromName!: string;

  @Column({ name: 'from_org', type: 'varchar', length: 160 })
  fromOrg!: string;

  @Column({ name: 'from_email', type: 'varchar', length: 320 })
  fromEmail!: string;

  @Column({ type: 'varchar', length: 2000 })
  message!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: 'new' | 'forwarded' | 'blocked' | 'failed';

  @Column({ name: 'forwarded_at', type: 'timestamptz', nullable: true })
  forwardedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'ip_hash', type: 'varchar', length: 64 })
  ipHash!: string;
}
