import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity.js';
import { OrganizationMember } from './entities/organization-member.entity.js';
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  AddMemberInput,
  OrgMemberResult,
} from './interfaces.js';
import type { OrgMemberRole, OrgMemberStatus } from './interfaces.js';

@Injectable()
export class OrgService {
  private readonly logger = new Logger(OrgService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
  ) {}

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const slug = input.slug ?? this.generateSlug(input.name);

    const existing = await this.orgRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(
        `Organization with slug "${slug}" already exists`,
      );
    }

    const org = this.orgRepo.create({
      name: input.name,
      slug,
      ownerId: input.ownerId,
      plan: input.plan ?? 'free',
      logoUrl: input.logoUrl,
    });
    const saved = await this.orgRepo.save(org);

    await this.memberRepo.save({
      organizationId: saved.id,
      userId: input.ownerId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    return saved;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.orgRepo.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.orgRepo.findOne({ where: { slug } });
  }

  async update(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization> {
    const org = await this.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    Object.assign(org, input);
    return this.orgRepo.save(org);
  }

  async delete(id: string): Promise<void> {
    const result = await this.orgRepo.softDelete(id);
    if (result.affected === 0)
      throw new NotFoundException('Organization not found');
  }

  async getMembers(organizationId: string): Promise<OrgMemberResult[]> {
    const members = await this.memberRepo.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
    return members.map((m) => this.toMemberResult(m));
  }

  async addMember(
    organizationId: string,
    input: AddMemberInput,
  ): Promise<OrgMemberResult> {
    const existing = await this.memberRepo.findOne({
      where: { organizationId, userId: input.userId },
    });
    if (existing) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    const member = this.memberRepo.create({
      organizationId,
      userId: input.userId,
      role: input.role ?? 'member',
      status: 'active',
      invitedBy: input.invitedBy,
      joinedAt: new Date(),
    });
    const saved = await this.memberRepo.save(member);
    return this.toMemberResult(saved);
  }

  async removeMember(organizationId: string, userId: string): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { organizationId, userId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') {
      throw new ConflictException(
        'Cannot remove the owner of the organization',
      );
    }
    await this.memberRepo.remove(member);
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: OrgMemberRole,
  ): Promise<OrgMemberResult> {
    const member = await this.memberRepo.findOne({
      where: { organizationId, userId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') {
      throw new ConflictException('Cannot change the role of the owner');
    }
    member.role = role;
    const saved = await this.memberRepo.save(member);
    return this.toMemberResult(saved);
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const memberships = await this.memberRepo.find({
      where: { userId, status: 'active' },
      relations: { organization: true },
    });
    return memberships.map((m) => m.organization).filter(Boolean);
  }

  async getUserRole(
    organizationId: string,
    userId: string,
  ): Promise<OrgMemberRole | null> {
    const member = await this.memberRepo.findOne({
      where: { organizationId, userId, status: 'active' },
    });
    return (member?.role as OrgMemberRole) ?? null;
  }

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 63) || `org-${Date.now()}`
    );
  }

  private toMemberResult(member: OrganizationMember): OrgMemberResult {
    return {
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role as OrgMemberRole,
      status: member.status as OrgMemberStatus,
      invitedBy: member.invitedBy,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
    };
  }
}
