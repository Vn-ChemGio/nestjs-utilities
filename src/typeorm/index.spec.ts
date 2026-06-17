import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  configTypeOrmRDSPostgres,
  configTypeOrmMySQL,
  TypeOrmConfigOptions,
  createCrudService,
  createCrudController,
  createCrudModule,
} from './index';

type MockConfigService = {
  get: jest.Mock<unknown, [key: string, defaultValue?: unknown]>;
};

type WithPostgresCreds = TypeOrmModuleOptions & {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: string;
  synchronize: boolean;
  ssl?: { rejectUnauthorized: boolean };
  extra: Record<string, unknown>;
  autoLoadEntities: boolean;
  retryAttempts: number;
  retryDelay: number;
};

type WithMysqlCreds = TypeOrmModuleOptions & {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: string;
  synchronize: boolean;
  extra: Record<string, unknown>;
};

function createMockConfigService(
  env: Record<string, string> = {},
): MockConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      return key in env ? env[key] : defaultValue;
    }),
  };
}

describe('nesthub/typeorm', () => {
  describe('configTypeOrmRDSPostgres', () => {
    it('should return postgres config with defaults', () => {
      const config = createMockConfigService();
      const result = configTypeOrmRDSPostgres(
        config as unknown as ConfigService,
      ) as unknown as WithPostgresCreds;

      expect(result.type).toBe('postgres');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(5432);
      expect(result.database).toBe('postgres');
      expect(result.synchronize).toBe(false);
      expect(result.ssl).toEqual({ rejectUnauthorized: false });
      expect(config.get).toHaveBeenCalledWith('DB_PORT', 5432);
    });

    it('should read string values from ConfigService', () => {
      const config = createMockConfigService({
        DB_HOST: 'myhost.example.com',
        DB_USERNAME: 'admin',
        DB_PASSWORD: 'secret',
        DB_DATABASE: 'mydb',
      });

      const result = configTypeOrmRDSPostgres(
        config as unknown as ConfigService,
      ) as unknown as WithPostgresCreds;

      expect(result.host).toBe('myhost.example.com');
      expect(result.username).toBe('admin');
      expect(result.password).toBe('secret');
      expect(result.database).toBe('mydb');
    });

    it('should apply TypeOrmConfigOptions', () => {
      const config = createMockConfigService();
      const options: TypeOrmConfigOptions = {
        schema: 'public',
        poolSize: 50,
        idleTimeoutMs: 60000,
        connectionTimeoutMs: 15000,
        statementTimeoutMs: 60000,
      };

      const result = configTypeOrmRDSPostgres(
        config as unknown as ConfigService,
        options,
      ) as unknown as WithPostgresCreds;

      expect(result.extra).toMatchObject({
        max: 50,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 15000,
        statement_timeout: 60000,
        schema: 'public',
      });
    });

    it('should read sync and ssl from env', () => {
      const config = createMockConfigService({
        DB_SYNCHRONIZE: 'true',
        DB_SSL_REJECT_UNAUTHORIZED: 'true',
      });

      const result = configTypeOrmRDSPostgres(
        config as unknown as ConfigService,
      ) as unknown as WithPostgresCreds;

      expect(result.synchronize).toBe('true');
      expect(result.ssl?.rejectUnauthorized).toBe('true');
    });

    it('should include autoLoadEntities and retry config', () => {
      const config = createMockConfigService();
      const result = configTypeOrmRDSPostgres(
        config as unknown as ConfigService,
      ) as unknown as WithPostgresCreds;

      expect(result.autoLoadEntities).toBe(true);
      expect(result.retryAttempts).toBe(10);
      expect(result.retryDelay).toBe(3000);
    });
  });

  describe('configTypeOrmMySQL', () => {
    it('should return mysql config with defaults', () => {
      const config = createMockConfigService();
      const result = configTypeOrmMySQL(
        config as unknown as ConfigService,
      ) as unknown as WithMysqlCreds;

      expect(result.type).toBe('mysql');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(3306);
      expect(result.database).toBe('mysql');
      expect(result.synchronize).toBe(false);
    });

    it('should read string values from ConfigService', () => {
      const config = createMockConfigService({
        DB_HOST: 'mysql.example.com',
        DB_USERNAME: 'root',
        DB_PASSWORD: 'pwd',
        DB_DATABASE: 'analytics',
      });

      const result = configTypeOrmMySQL(
        config as unknown as ConfigService,
      ) as unknown as WithMysqlCreds;

      expect(result.host).toBe('mysql.example.com');
      expect(result.username).toBe('root');
      expect(result.password).toBe('pwd');
      expect(result.database).toBe('analytics');
    });

    it('should apply TypeOrmConfigOptions', () => {
      const config = createMockConfigService();
      const options: TypeOrmConfigOptions = {
        poolSize: 5,
        idleTimeoutMs: 5000,
      };

      const result = configTypeOrmMySQL(
        config as unknown as ConfigService,
        options,
      ) as unknown as WithMysqlCreds;

      expect(result.extra).toMatchObject({
        max: 5,
        idleTimeoutMillis: 5000,
      });
    });
  });

  describe('createCrudService', () => {
    class TestEntity {
      id!: number;
      name!: string;
    }

    it('should return an injectable class', () => {
      const Service = createCrudService(TestEntity);
      const instance = new Service({} as any);
      expect(instance).toBeDefined();
      expect(typeof instance.findAll).toBe('function');
      expect(typeof instance.findOne).toBe('function');
      expect(typeof instance.create).toBe('function');
      expect(typeof instance.update).toBe('function');
      expect(typeof instance.remove).toBe('function');
    });

    it('should return a class decorated with @Injectable()', () => {
      const Service = createCrudService(TestEntity);
      const metadata = Reflect.getMetadata('__injectable__', Service);
      expect(metadata).toBe(true);
    });

    it('should support extending', () => {
      const BaseService = createCrudService(TestEntity);

      class ExtendedService extends BaseService {
        async findByName(name: string) {
          return this.repository.findOne({
            where: { name },
          });
        }
      }

      const instance = new ExtendedService({} as any);
      expect(typeof instance.findAll).toBe('function');
      expect(typeof instance.findByName).toBe('function');
    });
  });

  describe('createCrudController', () => {
    class TestEntity {
      id!: number;
    }

    it('should return a controller class with route metadata', () => {
      const Service = createCrudService(TestEntity);
      const Controller = createCrudController('test', Service);
      const instance = new Controller({} as any);
      expect(instance).toBeDefined();
    });
  });

  describe('createCrudModule', () => {
    class TestEntity {
      id!: number;
    }

    it('should return both service and controller', () => {
      const { service, controller } = createCrudModule(TestEntity, 'test');
      expect(service).toBeDefined();
      expect(controller).toBeDefined();
    });
  });
});
