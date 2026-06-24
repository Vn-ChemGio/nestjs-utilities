import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgModule } from './org.module.js';
import { OrgService } from './org.service.js';
import { Organization } from './entities/organization.entity.js';
import { OrganizationMember } from './entities/organization-member.entity.js';

describe('OrgModule', () => {
  let service: OrgService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Organization, OrganizationMember],
          synchronize: true,
          dropSchema: true,
        }),
        OrgModule.forRoot(),
      ],
    }).compile();

    service = module.get<OrgService>(OrgService);
  });

  it('should create an organization', async () => {
    const org = await service.create({
      name: 'Test Org',
      ownerId: 'user-1',
    });
    expect(org.id).toBeDefined();
    expect(org.name).toBe('Test Org');
    expect(org.slug).toBe('test-org');
    expect(org.ownerId).toBe('user-1');
  });

  it('should add and list members', async () => {
    const org = await service.create({ name: 'My Org', ownerId: 'user-1' });
    const member = await service.addMember(org.id, {
      userId: 'user-2',
      role: 'admin',
    });
    expect(member.role).toBe('admin');

    const members = await service.getMembers(org.id);
    expect(members).toHaveLength(2); // owner + new member
  });

  it('should find user organizations', async () => {
    const org1 = await service.create({ name: 'Org Alpha', ownerId: 'user-1' });
    const org2 = await service.create({ name: 'Org Beta', ownerId: 'user-2' });
    await service.addMember(org2.id, { userId: 'user-1' });

    const orgs = await service.getUserOrganizations('user-1');
    expect(orgs.map((o) => o.id)).toContain(org1.id);
    expect(orgs.map((o) => o.id)).toContain(org2.id);
  });

  it('should not allow duplicate slug', async () => {
    await service.create({ name: 'My Org', ownerId: 'user-1' });
    await expect(
      service.create({ name: 'My Org', ownerId: 'user-2' }),
    ).rejects.toThrow();
  });
});
