import {
  Global,
  Module,
  DynamicModule,
  Type,
  ForwardReference,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity.js';
import { OrganizationMember } from './entities/organization-member.entity.js';
import { OrgService } from './org.service.js';
import { ORG_MODULE_OPTIONS } from './org.constants.js';
import type { OrgModuleOptions } from './interfaces.js';

@Global()
@Module({})
export class OrgModule {
  static forRoot(options?: OrgModuleOptions): DynamicModule {
    const opts: OrgModuleOptions = { typeorm: { enabled: true }, ...options };
    return {
      module: OrgModule,
      imports: [TypeOrmModule.forFeature([Organization, OrganizationMember])],
      providers: [
        {
          provide: ORG_MODULE_OPTIONS,
          useValue: opts,
        },
        OrgService,
      ],
      exports: [OrgService],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: any[]
    ) => OrgModuleOptions | Promise<OrgModuleOptions>;
    inject?: any[];
    imports?: (
      | DynamicModule
      | Type<any>
      | Promise<DynamicModule>
      | ForwardReference
    )[];
  }): DynamicModule {
    return {
      module: OrgModule,
      imports: [
        ...(options.imports ?? []),
        TypeOrmModule.forFeature([Organization, OrganizationMember]),
      ],
      providers: [
        {
          provide: ORG_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        OrgService,
      ],
      exports: [OrgService],
    };
  }
}
