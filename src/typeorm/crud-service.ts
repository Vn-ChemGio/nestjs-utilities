import { Injectable, Type } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';
import { Repository } from 'typeorm';
import type { ICrudService } from './crud.interface.js';

export function createCrudService<
  Entity extends ObjectLiteral & { id: string | number },
>(entity: Type<Entity>): Type<ICrudService<Entity>> {
  @Injectable()
  class CrudService implements ICrudService<Entity> {
    public readonly repository: Repository<Entity>;

    constructor(
      @InjectRepository(entity)
      repository: Repository<Entity>,
    ) {
      this.repository = repository;
    }

    async findAll(options?: FindManyOptions<Entity>): Promise<Entity[]> {
      return this.repository.find(options);
    }

    async findOne(
      id: string | number,
      options?: FindOneOptions<Entity>,
    ): Promise<Entity | null> {
      return this.repository.findOne({
        where: { id } as unknown as FindOptionsWhere<Entity>,
        ...options,
      });
    }

    async create(data: DeepPartial<Entity>): Promise<Entity> {
      const entity = this.repository.create(data);
      return this.repository.save(entity);
    }

    async update(
      id: string | number,
      data: DeepPartial<Entity>,
    ): Promise<Entity> {
      await this.repository.update(id, data);
      return this.findOne(id) as Promise<Entity>;
    }

    async remove(id: string | number): Promise<void> {
      await this.repository.delete(id);
    }
  }

  return CrudService;
}
