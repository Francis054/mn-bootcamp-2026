import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** `id` is a hash of the cookie value. The cookie value itself is not stored. */
@Entity({ name: 'sessions' })
export class SessionEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
