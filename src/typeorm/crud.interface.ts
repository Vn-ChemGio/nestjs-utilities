import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
} from 'typeorm';

export interface ICrudService<Entity extends ObjectLiteral> {
  readonly repository: Repository<Entity>;
  findAll(options?: FindManyOptions<Entity>): Promise<Entity[]>;

  findOne(
    id: string | number,
    options?: FindOneOptions<Entity>,
  ): Promise<Entity | null>;

  create(data: DeepPartial<Entity>): Promise<Entity>;

  update(id: string | number, data: DeepPartial<Entity>): Promise<Entity>;

  remove(id: string | number): Promise<void>;
}
