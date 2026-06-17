# nesthub/typeorm

TypeORM configuration helpers for cloud databases (RDS PostgreSQL / MySQL), plus CRUD service & controller factories.

## Installation

```bash
npm install nesthub @nestjs/typeorm @nestjs/config
```

## Prerequisites

The following environment variables must be declared in your `.env` file (or provided to `ConfigModule.forRoot()`):

| Variable | Required | Default |
|---|---|---|
| `DB_HOST` | No | `localhost` |
| `DB_PORT` | No | `5432` (PG) / `3306` (MySQL) |
| `DB_USERNAME` | Yes | — |
| `DB_PASSWORD` | Yes | — |
| `DB_DATABASE` | No | `postgres` / `mysql` |
| `DB_SYNCHRONIZE` | No | `false` |
| `DB_LOGGING` | No | `false` |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | `false` |

## Usage

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { configTypeOrmRDSPostgres } from 'nesthub/typeorm'

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        configTypeOrmRDSPostgres(config, {
          poolSize: 20,
          schema: 'public',
        }),
    }),
  ],
})
export class AppModule {}
```

## Environment variables

| Variable | Default | Type | Description |
|---|---|---|---|
| `DB_HOST` | `localhost` | `string` | Database host |
| `DB_PORT` | `5432` (PG) / `3306` (MySQL) | `number` | Connection port |
| `DB_USERNAME` | — | `string` | Database username |
| `DB_PASSWORD` | — | `string` | Database password |
| `DB_DATABASE` | `postgres` / `mysql` | `string` | Database name |
| `DB_SYNCHRONIZE` | `false` | `boolean` | Auto-sync schema (dev only) |
| `DB_LOGGING` | `false` | `boolean` | Enable query logging |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` | `boolean` | Reject unauthorized SSL certs |

## TypeOrmConfigOptions

| Option | Default | Description |
|---|---|---|
| `schema` | — | PostgreSQL schema (e.g. `public`) |
| `poolSize` | `20` (PG) / `10` (MySQL) | Maximum connections in pool |
| `idleTimeoutMs` | `30000` (PG) / `10000` (MySQL) | Max idle time before closing |
| `connectionTimeoutMs` | `10000` (PG) / `5000` (MySQL) | Connection timeout |
| `statementTimeoutMs` | `30000` (PG) | Query timeout |

## SSL — why both `ssl` and `extra.ssl`?

```typescript
ssl: { rejectUnauthorized: false },
extra: {
  ssl: { rejectUnauthorized: false },
  // ...
}
```

- **`ssl`** — tells TypeORM to configure the driver (`pg` / `mysql2`) with TLS
- **`extra.ssl`** — passes SSL config directly to the underlying driver pool

Cloud databases (AWS RDS, Google Cloud SQL, etc.) often use self-signed certificates, requiring `rejectUnauthorized: false` to trust them.

## Sample .env

```bash
DB_HOST=database-1.xxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=my-secret-pw
DB_DATABASE=mydb
DB_SYNCHRONIZE=false
DB_LOGGING=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

---

## CRUD Service & Controller Factories

Generate ready-to-use CRUD service and controller classes for any TypeORM entity.

### `createCrudService(entity)`

Creates a base `@Injectable()` service class with `@InjectRepository(entity)` and standard CRUD methods (`findAll`, `findOne`, `create`, `update`, `remove`).

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { createCrudService } from 'nesthub/typeorm'
import { User } from './user.entity'

const UserService = createCrudService(User)

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
})
export class UserModule {}
```

#### Extending

```typescript
import { Injectable } from '@nestjs/common'
import { createCrudService } from 'nesthub/typeorm'
import { User } from './user.entity'

const BaseUserService = createCrudService(User)

@Injectable()
export class UserService extends BaseUserService {
  async findByEmail(email: string) {
    return this.repository.findOne({ where: { email } })
  }
}
```

### `createCrudController(route, serviceClass)`

Creates a `@Controller()` class with REST endpoints (`GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`) delegating to the given CRUD service.

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  createCrudService,
  createCrudController,
} from 'nesthub/typeorm'
import { User } from './user.entity'

const UserService = createCrudService(User)
const UserController = createCrudController('users', UserService)

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

### `createCrudModule(entity, route)`

Convenience helper that returns both `service` and `controller` in one call.

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { createCrudModule } from 'nesthub/typeorm'
import { User } from './user.entity'

const { service: UserService, controller: UserController } =
  createCrudModule(User, 'users')

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

### API

| Method | Endpoint | Description |
|---|---|---|
| `findAll` | `GET /` | List all records |
| `findOne` | `GET /:id` | Get one record by ID |
| `create` | `POST /` | Create a new record |
| `update` | `PATCH /:id` | Update an existing record |
| `remove` | `DELETE /:id` | Delete a record |
