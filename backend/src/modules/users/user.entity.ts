import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Role } from './role.js';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ type: 'varchar', length: 8 })
  initials!: string;

  @Column({ type: 'smallint' })
  hue!: number;

  @Column({ type: 'varchar', length: 32 })
  role!: Role;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  /** Null until the person confirms the mailbox. Staff created before signup are backfilled. */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  /** Roster row this login belongs to. One user per trainee. */
  @Column({ name: 'trainee_id', type: 'varchar', length: 64, nullable: true, unique: true })
  traineeId!: string | null;

  /** Set when an administrator suspends the account. Login and existing sessions stop. */
  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
