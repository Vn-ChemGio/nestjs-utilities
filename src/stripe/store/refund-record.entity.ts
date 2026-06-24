import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('stripe_refund_records')
export class RefundRecordEntity {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'refund_id' })
  refundId: string;

  @Column({ name: 'payment_intent_id' })
  @Index()
  paymentIntentId: string;

  @Column()
  amount: number;

  @Column()
  currency: string;

  @Column()
  status: string;

  @Column('text', { nullable: true })
  reason?: string;

  @Column('simple-json', { nullable: true })
  metadata?: Record<string, string>;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
