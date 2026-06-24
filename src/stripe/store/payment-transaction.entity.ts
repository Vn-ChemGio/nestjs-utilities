import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('stripe_payment_transactions')
export class PaymentTransactionEntity {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'payment_intent_id' })
  @Index()
  paymentIntentId: string;

  @Column()
  amount: number;

  @Column()
  currency: string;

  @Column()
  status: string;

  @Column({ name: 'customer_id', nullable: true })
  customerId?: string;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('simple-json', { nullable: true })
  metadata?: Record<string, string>;

  @Column('text', { nullable: true })
  error?: string;

  @Column({ name: 'idempotency_key', nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
