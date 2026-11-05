import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const OUTBOX_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/**
 * One queued message. The address, subject, and body are what Resend needs
 * for a retry. The row does not store the API key, the from address, or a
 * session token except where that token is already inside the message body.
 */
@Entity({ name: 'email_outbox' })
export class EmailOutboxEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64, nullable: true })
  traineeId!: string | null;

  @Column({ type: 'varchar', length: 40 })
  kind!: string;

  @Column({ name: 'to_address', type: 'varchar', length: 320 })
  toAddress!: string;

  @Column({ name: 'reply_to', type: 'varchar', length: 320, nullable: true })
  replyTo!: string | null;

  @Column({ type: 'varchar', length: 200 })
  subject!: string;

  @Column({ name: 'text_body', type: 'text' })
  textBody!: string;

  @Column({ name: 'html_body', type: 'text' })
  htmlBody!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: OutboxStatus;

  @Column({ type: 'int' })
  attempts!: number;

  @Column({ name: 'max_attempts', type: 'int' })
  maxAttempts!: number;

  @Column({ name: 'last_error', type: 'varchar', length: 300, nullable: true })
  lastError!: string | null;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  nextAttemptAt!: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
