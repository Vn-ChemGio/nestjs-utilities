import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Type } from '@nestjs/common';
import type { ObjectLiteral } from 'typeorm';
import type { ICrudService } from './crud.interface.js';
import { createCrudService } from './crud-service.js';
import { createCrudController } from './crud-controller.js';

export { createCrudService } from './crud-service.js';
export { createCrudController } from './crud-controller.js';
export type { ICrudService } from './crud.interface.js';

export function createCrudModule<
  Entity extends ObjectLiteral & { id: string | number },
>(
  entity: Type<Entity>,
  route: string,
): {
  service: Type<ICrudService<Entity>>;
  controller: Type<any>;
} {
  const service = createCrudService(entity);
  const controller = createCrudController(route, service);
  return { service, controller };
}

export interface TypeOrmConfigOptions {
  schema?: string;
  poolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  statementTimeoutMs?: number;
}

export function configTypeOrmRDSPostgres(
  configService: ConfigService,
  options?: TypeOrmConfigOptions,
): TypeOrmModuleOptions {
  const rejectUnauthorized = configService.get<boolean>(
    'DB_SSL_REJECT_UNAUTHORIZED',
    false,
  );
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string | undefined>('DB_USERNAME'),
    password: configService.get<string | undefined>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE', 'postgres'),
    synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
    logging: configService.get<boolean>('DB_LOGGING', false) ? 'all' : false,
    ssl: { rejectUnauthorized },
    extra: {
      ssl: { rejectUnauthorized },
      max: options?.poolSize ?? 20,
      idleTimeoutMillis: options?.idleTimeoutMs ?? 30000,
      connectionTimeoutMillis: options?.connectionTimeoutMs ?? 10000,
      statement_timeout: options?.statementTimeoutMs ?? 30000,
      ...(options?.schema ? { schema: options.schema } : {}),
    },
    autoLoadEntities: true,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}

export function configTypeOrmMySQL(
  configService: ConfigService,
  options?: TypeOrmConfigOptions,
): TypeOrmModuleOptions {
  const rejectUnauthorized = configService.get<boolean>(
    'DB_SSL_REJECT_UNAUTHORIZED',
    false,
  );
  return {
    type: 'mysql',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 3306),
    username: configService.get<string | undefined>('DB_USERNAME'),
    password: configService.get<string | undefined>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE', 'mysql'),
    synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
    logging: configService.get<boolean>('DB_LOGGING', false) ? 'all' : false,
    ssl: { rejectUnauthorized },
    extra: {
      ssl: { rejectUnauthorized },
      max: options?.poolSize ?? 10,
      idleTimeoutMillis: options?.idleTimeoutMs ?? 10000,
      connectionTimeoutMillis: options?.connectionTimeoutMs ?? 5000,
    },
    autoLoadEntities: true,
    retryAttempts: 10,
    retryDelay: 3000,
  };
}
