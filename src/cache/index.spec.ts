import { CACHE_MANAGER, CacheModule } from './index';

describe('nesthub/cache', () => {
  describe('CACHE_MANAGER', () => {
    it('should be the string CACHE_MANAGER', () => {
      expect(CACHE_MANAGER).toBe('CACHE_MANAGER');
    });
  });

  describe('CacheModule.forRoot', () => {
    it('should return a DynamicModule', () => {
      const mod = CacheModule.forRoot();

      expect(mod.module).toBe(CacheModule);
      expect(mod.exports).toContain(CACHE_MANAGER);
      expect(mod.providers).toHaveLength(1);
    });

    describe('with direct URL', () => {
      it('should omit inject array', () => {
        const mod = CacheModule.forRoot({ url: 'valkey://localhost:6379' });
        const provider = mod.providers![0] as any;

        expect(provider.provide).toBe(CACHE_MANAGER);
        expect(provider.inject).toBeUndefined();
        expect(provider.useFactory).toBeInstanceOf(Function);
      });

      it('should accept redis store with URL', () => {
        const mod = CacheModule.forRoot({
          store: 'redis',
          url: 'redis://localhost:6379',
          namespace: 'myapp',
        });
        const provider = mod.providers![0] as any;

        expect(provider.provide).toBe(CACHE_MANAGER);
      });
    });

    describe('without URL (env-based)', () => {
      it('should include ConfigService in inject array', () => {
        const mod = CacheModule.forRoot({ store: 'valkey' });
        const provider = mod.providers![0] as any;

        expect(provider.provide).toBe(CACHE_MANAGER);
        expect(provider.inject).toBeDefined();
        expect(provider.inject).toHaveLength(1);
        expect(provider.useFactory).toBeInstanceOf(Function);
      });

      it('should throw on missing env var', async () => {
        const mod = CacheModule.forRoot({ store: 'valkey' });
        const provider = mod.providers![0] as any;
        const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

        await expect(provider.useFactory(mockConfig)).rejects.toThrow(
          'Missing VALKEY_URL environment variable',
        );
        expect(mockConfig.get).toHaveBeenCalledWith('VALKEY_URL');
      });

      it('should read REDIS_URL for redis store', async () => {
        const mod = CacheModule.forRoot({ store: 'redis' });
        const provider = mod.providers![0] as any;
        const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

        await expect(provider.useFactory(mockConfig)).rejects.toThrow(
          'REDIS_URL',
        );
        expect(mockConfig.get).toHaveBeenCalledWith('REDIS_URL');
      });
    });
  });
});
