# nesthub/org

Organization and workspace management for multi-tenant NestJS SaaS apps.

## Features

- **Organizations** — create, update, delete orgs with unique slugs
- **Members** — add/remove members, assign roles (owner, admin, member, viewer)
- **Plans** — track plan tier (free, starter, pro, enterprise)
- **Invitations** — manage member invitations

## Usage

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgModule } from 'nesthub/org';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    OrgModule.forRoot(),
  ],
})
export class AppModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import { OrgService } from 'nesthub/org';

@Injectable()
export class TeamService {
  constructor(private readonly orgs: OrgService) {}

  async createTeam(name: string, ownerId: string) {
    const org = await this.orgs.create({ name, ownerId });
    return this.orgs.addMember(org.id, { userId: 'user-2', role: 'admin' });
  }
}
```
