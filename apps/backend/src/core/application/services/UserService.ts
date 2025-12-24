// apps/backend/src/core/application/services/UserService.ts

import { IUserRepository } from '../../ports/IUserRepository';
import { User } from '../../domain/user';

export class UserService {
  constructor(private readonly userRepository: IUserRepository) {}

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async createUser(user: User): Promise<User> {
    // Add business logic/validation here before creating
    return this.userRepository.create(user);
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    // Add business logic/validation here before updating
    return this.userRepository.update(id, user);
  }

  async deleteUser(id: string): Promise<void> {
    // Add business logic/validation here before deleting
    return this.userRepository.delete(id);
  }

  async getAllUsers(tenantId: string): Promise<User[]> {
    return this.userRepository.findAll(tenantId);
  }
}
