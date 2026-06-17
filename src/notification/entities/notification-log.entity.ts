import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type NotificationStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'expired';

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel', length: 20 })
  @Index()
  channel: string;

  @Column('simple-json', { name: 'recipient_to' })
  to: string | string[];

  @Column({ name: 'subject', nullable: true })
  subject?: string;

  @Column({ name: 'status', length: 20, default: 'pending' })
  @Index()
  status: NotificationStatus;

  @Column('text', { name: 'content', nullable: true })
  content?: string;

  @Column({ name: 'message_id', nullable: true })
  messageId?: string;

  @Column('text', { name: 'error', nullable: true })
  error?: string;

  @Column('simple-json', { name: 'metadata', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sent_at', nullable: true })
  sentAt?: Date;
}
