import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A short-lived permission to upload one video. The file does not pass through the API when Cloudinary is configured. */
@Entity({ name: 'portfolio_video_grants' })
export class PortfolioVideoGrantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @Column({ name: 'trainee_id', type: 'varchar', length: 64 })
  traineeId!: string;

  @Column({ name: 'public_id', type: 'varchar', length: 200 })
  publicId!: string;

  @Column({ type: 'varchar', length: 100 })
  mime!: string;

  @Column({ name: 'max_bytes', type: 'int' })
  maxBytes!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
