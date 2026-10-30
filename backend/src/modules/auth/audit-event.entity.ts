import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

const AUTH_AUDIT_ACTIONS = ['auth.login.succeeded', 'auth.login.failed', 'auth.logout'] as const;

const ACCOUNT_AUDIT_ACTIONS = [
  'auth.password.changed',
  'auth.password.reset.requested',
  'auth.password.reset.completed',
  'auth.user.invited',
  'auth.user.role.updated',
  'enquiry.created',
  'enquiry.updated',
  'enquiry.deleted',
] as const;

export const CURRICULUM_KINDS = [
  'track',
  'module',
  'phase',
  'lesson',
  'trainee',
  'project',
  'event',
  'media',
  'work_photo',
  'timetable',
  'site_image',
  'homepage',
  'about',
  'milestone',
  'settings',
] as const;
export const CURRICULUM_VERBS = [
  'created',
  'updated',
  'published',
  'unpublished',
  'deleted',
] as const;

export type CurriculumKind = (typeof CURRICULUM_KINDS)[number];
export type CurriculumVerb = (typeof CURRICULUM_VERBS)[number];
export type CurriculumAuditAction = `curriculum.${CurriculumKind}.${CurriculumVerb}`;

export type AuditAction =
  | (typeof AUTH_AUDIT_ACTIONS)[number]
  | (typeof ACCOUNT_AUDIT_ACTIONS)[number]
  | CurriculumAuditAction;

export const AUDIT_ACTIONS: readonly AuditAction[] = [
  ...AUTH_AUDIT_ACTIONS,
  ...ACCOUNT_AUDIT_ACTIONS,
  ...CURRICULUM_KINDS.flatMap((kind) =>
    CURRICULUM_VERBS.map((verb): CurriculumAuditAction => `curriculum.${kind}.${verb}`),
  ),
];

/**
 * POSIX pattern on `audit_events.action`. The database accepts any name of
 * this shape. This list is the real allow-list, checked before a row is written.
 * Do not change the pattern here without a new migration.
 */
export const AUDIT_ACTION_PATTERN_SOURCE = '^[a-z_]+(\\.[a-z_]+)+$';
export const AUDIT_ACTION_PATTERN = new RegExp(AUDIT_ACTION_PATTERN_SOURCE);

export function isAuditAction(value: string): value is AuditAction {
  return AUDIT_ACTION_PATTERN.test(value) && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function curriculumAuditAction(kind: CurriculumKind, verb: CurriculumVerb): AuditAction {
  return `curriculum.${kind}.${verb}`;
}

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

  /** What changed, for example `lesson`. Auth rows leave this empty. */
  @Column({ name: 'subject_type', type: 'varchar', length: 32, nullable: true })
  subjectType!: string | null;

  /** The row id. Not the title, the notes, or a mailbox. */
  @Column({ name: 'subject_id', type: 'varchar', length: 64, nullable: true })
  subjectId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
