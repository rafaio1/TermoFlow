// apps/backend/src/core/ports/IUserRepository.ts

import { User } from '../domain/user';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(tenantId: string): Promise<User[]>;
}
