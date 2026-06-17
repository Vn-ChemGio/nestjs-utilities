import { Global, Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Keyv from 'keyv';
import { Cacheable } from 'cacheable';

export const CACHE_MANAGER = 'CACHE_MANAGER';

export interface CacheModuleOptions {
  namespace?: string;
  store?: 'valkey' | 'redis';
  url?: string;
}

async function loadAdapter(store: 'valkey' | 'redis', url: string) {
  if (store === 'valkey') {
    const { default: KeyvValkey } = await import('@keyv/valkey');
    return new KeyvValkey(url);
  }
  const { default: KeyvRedis } = await import('@keyv/redis');
  return new KeyvRedis(url);
}

function buildCacheable(adapter: unknown, namespace: string): Cacheable {
  const keyv = new Keyv({ store: adapter });
  return new Cacheable({ primary: keyv, namespace });
}

@Global()
@Module({})
export class CacheModule {
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    const { namespace = '{default}', store = 'valkey' } = options;

    if (options.url) {
      return {
        module: CacheModule,
        providers: [
          {
            provide: CACHE_MANAGER,
            useFactory: async () => {
              const adapter = await loadAdapter(store, options.url!);
              return buildCacheable(adapter, namespace);
            },
          },
        ],
        exports: [CACHE_MANAGER],
      };
    }

    return {
      module: CacheModule,
      providers: [
        {
          provide: CACHE_MANAGER,
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => {
            const envKey = store === 'valkey' ? 'VALKEY_URL' : 'REDIS_URL';
            const connectionUrl = configService.get<string>(envKey);
            if (!connectionUrl) {
              throw new Error(
                `Missing ${envKey} environment variable. Set it or pass "url" to forRoot().`,
              );
            }
            const adapter = await loadAdapter(store, connectionUrl);
            return buildCacheable(adapter, namespace);
          },
        },
      ],
      exports: [CACHE_MANAGER],
    };
  }
}
