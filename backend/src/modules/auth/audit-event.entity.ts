import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const AUDIT_ACTIONS = ['auth.login.succeeded', 'auth.login.failed', 'auth.logout'] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

@Entity({ name: 'audit_events' })
export class AuditEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  action!: AuditAction;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 80, nullable: true })
  requestId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
