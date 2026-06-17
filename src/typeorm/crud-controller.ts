import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Type,
} from '@nestjs/common';
import type { DeepPartial, ObjectLiteral } from 'typeorm';
import type { ICrudService } from './crud.interface.js';

export function createCrudController<Entity extends ObjectLiteral>(
  route: string,
  serviceClass: Type<ICrudService<Entity>>,
): Type<any> {
  @Controller(route)
  class CrudController {
    constructor(
      @Inject(serviceClass)
      private readonly service: ICrudService<Entity>,
    ) {}

    @Get()
    async getMany(): Promise<Entity[]> {
      return this.service.findAll();
    }

    @Get(':id')
    async getOne(@Param('id') id: string): Promise<Entity | null> {
      return this.service.findOne(id);
    }

    @Post()
    async create(@Body() data: DeepPartial<Entity>): Promise<Entity> {
      return this.service.create(data);
    }

    @Patch(':id')
    async update(
      @Param('id') id: string,
      @Body() data: DeepPartial<Entity>,
    ): Promise<Entity> {
      return this.service.update(id, data);
    }

    @Delete(':id')
    async remove(@Param('id') id: string): Promise<void> {
      return this.service.remove(id);
    }
  }

  return CrudController;
}
