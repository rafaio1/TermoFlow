import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';

import { createApp } from '../../src/app';
import { connectMongo, disconnectMongo, getMongoDb } from '../../src/infrastructure/database/mongo';
import { connectPostgres, disconnectPostgres, postgres } from '../../src/infrastructure/database/postgres';

// Import the real implementations for DI
import { PrismaItemRepository } from '../../src/infrastructure/database/repositories/postgres/ItemRepository';
import { ItemService } from '../../src/core/application/services/ItemService';
import { ItemController } from '../../src/infrastructure/web/controllers/ItemController';
import { OrganizationController } from '../../src/infrastructure/web/controllers/OrganizationController'; // Add missing import for type

// Mock the OrganizationService module
const mockOrganizationServiceInstance = {
  organizationRepository: {} as any, // Mock the repository
  getAllOrganizations: jest.fn(),
  createOrganization: jest.fn(),
  updateOrganization: jest.fn(),
  deleteOrganization: jest.fn(),
  getOrganizationById: jest.fn(),
  getOrganizationByCode: jest.fn(),
};
jest.mock('../../src/core/application/services/OrganizationService', () => ({
  OrganizationService: jest.fn(() => mockOrganizationServiceInstance),
}));
import { OrganizationService } from '../../src/core/application/services/OrganizationService'; // Re-import the mocked service
import { IItemRepository } from '../../src/core/ports/IItemRepository'; // Add missing import


const describeDb = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;

async function makeApp(): Promise<Express> {
  // The real postgres client will be used here, as it's an integration test.
  // Instantiating real dependencies
  const itemRepository = new PrismaItemRepository(postgres);
  const itemService = new ItemService(itemRepository as IItemRepository); // Explicitly cast to IItemRepository
  const itemController = new ItemController(itemService);

  // Instantiate the mocked OrganizationService and OrganizationController
  const organizationService = new OrganizationService(null as any); // Constructor takes a repo, but we are fully mocking methods
  const organizationController = new OrganizationController(organizationService);

  return createApp({
    postgres, // Pass the real postgres client
    itemController,
    organizationController,
  });
}

describeDb('items (db integration)', () => {
  jest.setTimeout(60_000);

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    await connectPostgres();
    await connectMongo();
  });

  afterAll(async () => {
    await Promise.allSettled([disconnectPostgres(), disconnectMongo()]);
  });

  it('creates item, lists it, writes audit log', async () => {
    const tenantId = randomUUID();
    const userId = randomUUID();
    const app = await makeApp(); // Use the makeApp helper

    try {
      const created = await request(app)
        .post('/items')
        .set('x-tenant-id', tenantId)
        .set('x-user-id', userId)
        .send({ name: '  Integration Item  ' })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(created.body).toHaveProperty('id');
      expect(created.body).toMatchObject({
        tenantId,
        name: 'Integration Item',
        createdByUserId: userId,
        updatedByUserId: userId,
        deletedAt: null,
      });

      const itemId = String(created.body.id);

      const list = await request(app).get('/items').set('x-tenant-id', tenantId).expect(200);
      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.some((item: any) => item.id === itemId)).toBe(true);

      const audit = await getMongoDb()
        .collection('audit_logs')
        .findOne({ action: 'item.created', tenantId, actorUserId: userId, 'payload.itemId': itemId });
      expect(audit).toBeTruthy();
    } finally {
      await postgres.item.deleteMany({ where: { tenantId } });
      await getMongoDb().collection('audit_logs').deleteMany({ tenantId });
    }
  });
});

