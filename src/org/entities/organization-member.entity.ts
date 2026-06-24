import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity.js';

@Entity('org_members')
@Index(['organizationId', 'userId'], { unique: true })
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (org) => org.members)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'user_id', length: 255 })
  userId: string;

  @Column({ default: 'member', length: 50 })
  role: string;

  @Column({ default: 'active', length: 50 })
  status: string;

  @Column({ name: 'invited_by', nullable: true, length: 255 })
  invitedBy?: string;

  @Column({ name: 'joined_at', nullable: true })
  joinedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
