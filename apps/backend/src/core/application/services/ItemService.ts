// apps/backend/src/core/application/services/ItemService.ts

import { IItemRepository } from '../../ports/IItemRepository';
import { Item } from '../../domain/item';

export class ItemService {
  constructor(private readonly itemRepository: IItemRepository) {}

  async getItemById(id: string): Promise<Item | null> {
    return this.itemRepository.findById(id);
  }

  async createItem(item: Item): Promise<Item> {
    // Add business logic/validation here before creating
    return this.itemRepository.create(item);
  }

  async updateItem(id: string, item: Partial<Item>): Promise<Item> {
    // Add business logic/validation here before updating
    return this.itemRepository.update(id, item);
  }

  async deleteItem(id: string): Promise<void> {
    // Add business logic/validation here before deleting
    return this.itemRepository.delete(id);
  }

  async getAllItems(tenantId: string): Promise<Item[]> {
    return this.itemRepository.findAll(tenantId);
  }
}
