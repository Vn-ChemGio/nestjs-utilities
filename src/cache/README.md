# nesthub/cache

A global NestJS cache module using [Keyv](https://keyv.org/) + [Cacheable](https://github.com/jaredwray/cacheable) with Valkey or Redis backend.

## Installation

```bash
npm install nesthub keyv cacheable
```

Depending on your store:

- **Valkey**: `npm install @keyv/valkey`
- **Redis**: `npm install @keyv/redis`

## Quick start

### Valkey (reads `VALKEY_URL` from env)

```typescript
// app.module.ts
import { CacheModule } from 'nesthub/cache'

@Module({
  imports: [
    CacheModule.forRoot({ store: 'valkey' }),
    // Requires VALKEY_URL in your .env:
    // VALKEY_URL=valkey://localhost:6379
  ],
})
export class AppModule {}
```

### Redis (reads `REDIS_URL` from env)

```typescript
CacheModule.forRoot({ store: 'redis' })
// Requires REDIS_URL in .env:
// REDIS_URL=redis://localhost:6379
```

### Direct URL (no env vars needed)

```typescript
CacheModule.forRoot({
  store: 'valkey',
  url: 'valkey://user:pass@host:6379',
})
```

## Usage in a service

```typescript
import { Inject } from '@nestjs/common'
import { CACHE_MANAGER } from 'nesthub/cache'
import { Cacheable } from 'cacheable'

@Injectable()
export class MyService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cacheable,
  ) {}

  async getData(key: string) {
    return this.cache.get(key)
  }

  async setData(key: string, value: unknown, ttl?: number) {
    await this.cache.set(key, value, ttl)
  }
}
```

## CacheModuleOptions

| Option | Default | Description |
|---|---|---|
| `store` | `'valkey'` | Backend store: `'valkey'` or `'redis'` |
| `namespace` | `'{default}'` | Cache namespace prefix |
| `url` | — | Connection URL. If omitted, reads `VALKEY_URL` or `REDIS_URL` from env |

## How it works

```
Cacheable  →  Keyv  →  KeyvValkey / KeyvRedis  →  Valkey / Redis
```

- `KeyvValkey` / `KeyvRedis` connects to the backend
- `Keyv` wraps it with a uniform API
- `Cacheable` adds TTL, namespace, and caching logic
- The module is `@Global()`, so `CACHE_MANAGER` is available everywhere
