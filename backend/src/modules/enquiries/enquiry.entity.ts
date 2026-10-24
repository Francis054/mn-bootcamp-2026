import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'enquiries' })
export class EnquiryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 80 })
  topic!: string;

  @Column({ type: 'varchar', length: 5000 })
  message!: string;

  @Column({ type: 'boolean', default: false })
  handled!: boolean;

  @Column({ type: 'boolean', default: false })
  notified!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
