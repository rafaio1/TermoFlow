// apps/backend/src/core/ports/IItemRepository.ts

import { Item } from '../domain/item';

export interface IItemRepository {
  findById(id: string): Promise<Item | null>;
  create(item: Item): Promise<Item>;
  update(id: string, item: Partial<Item>): Promise<Item>;
  delete(id: string): Promise<void>;
  findAll(tenantId: string): Promise<Item[]>;
}
