import request from 'supertest';
import type { Express } from 'express';
import { PrismaClient } from '@prisma/client';

// New imports for the refactored architecture
import { Organization, OrganizationStatus } from '../../src/core/domain/organization';
import { OrganizationController } from '../../src/infrastructure/web/controllers/OrganizationController';
import { ItemController } from '../../src/infrastructure/web/controllers/ItemController'; // Add missing import for type

// Mocks for external dependencies (database connections)
jest.mock('../../src/infrastructure/database/postgres', () => ({
  postgres: { $queryRaw: jest.fn().mockResolvedValue(1) },
}));

jest.mock('../../src/infrastructure/database/mongo', () => ({
  getMongoDb: () => ({ command: jest.fn().mockResolvedValue({ ok: 1 }) }),
}));

// Mock the OrganizationService module (moved to top level)
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

// Mock the ItemService module (moved to top level)
const mockItemServiceInstance = {
  itemRepository: {} as any, // Mock the repository
  getAllItems: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  getItemById: jest.fn(),
};
jest.mock('../../src/core/application/services/ItemService', () => ({
  ItemService: jest.fn(() => mockItemServiceInstance),
}));
import { ItemService } from '../../src/core/application/services/ItemService'; // Re-import the mocked service

async function makeApp(
  mockedOrganizationService: Partial<OrganizationService> = mockOrganizationServiceInstance, // Use the instance directly
): Promise<Express> {
  const mod = await import('../../src/app');
  // The postgres client is mocked globally by jest.mock at the top,
  // so createApp will receive the mocked version through its internal imports.
  const { postgres } = await import('../../src/infrastructure/database/postgres'); // Re-import to get the mocked version

  const organizationService = new OrganizationService(null as any); // Constructor takes a repo, but we are fully mocking methods
  const organizationController = new OrganizationController(organizationService);

  // Instantiate the mocked ItemService and ItemController
  const itemService = new ItemService(null as any); // Constructor takes a repo, but we are fully mocking methods
  const itemController = new ItemController(itemService);

  return mod.createApp({
    postgres: postgres as unknown as PrismaClient, // Cast as PrismaClient
    itemController,
    organizationController,
  });
}

describe('organizations routes', () => {
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const organizationId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  it('GET /organizations requires x-tenant-id', async () => {
    const app = await makeApp();
    await request(app).get('/organizations').expect(400);
  });

  it('GET /organizations lists organizations', async () => {
    const now = new Date('2025-01-01T00:00:00.000Z');
    mockOrganizationServiceInstance.getAllOrganizations.mockResolvedValueOnce([
      {
        id: organizationId,
        tenantId,
        code: '12341',
        name: 'Org',
        status: OrganizationStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        deletedAt: undefined,
        createdByUserId: undefined,
        updatedByUserId: undefined,
      },
    ]);

    const app = await makeApp();
    const res = await request(app).get('/organizations').set('x-tenant-id', tenantId).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(mockOrganizationServiceInstance.getAllOrganizations).toHaveBeenCalledWith(tenantId);
    expect(res.body[0]).toMatchObject({
      id: organizationId,
      code: '12341',
      name: 'Org',
      status: 'ACTIVE',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });

  it('POST /organizations creates organization (requires x-user-id)', async () => {
    const now = new Date('2025-01-01T00:00:00.000Z');
    mockOrganizationServiceInstance.createOrganization.mockResolvedValueOnce({
      id: organizationId,
      tenantId,
      code: '12341',
      name: 'Org',
      status: OrganizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
      createdByUserId: userId,
      updatedByUserId: userId,
    });

    const app = await makeApp();

    await request(app)
      .post('/organizations')
      .set('x-tenant-id', tenantId)
      .set('x-user-id', userId)
      .send({ code: '12341', name: 'Org', status: 'ACTIVE' })
      .set('Content-Type', 'application/json')
      .expect(201);

    expect(mockOrganizationServiceInstance.createOrganization).toHaveBeenCalledWith({
      id: '', // id is passed as empty, service/repo generates it
      tenantId,
      code: '12341',
      name: 'Org',
      status: OrganizationStatus.ACTIVE,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      createdByUserId: userId,
      updatedByUserId: userId,
    });
  });

  it('PATCH /organizations/:id returns 404 when missing', async () => {
    mockOrganizationServiceInstance.updateOrganization.mockResolvedValueOnce(null);

    const app = await makeApp();
    await request(app)
      .patch(`/organizations/${organizationId}`)
      .set('x-tenant-id', tenantId)
      .set('x-user-id', userId)
      .send({ name: 'New' })
      .set('Content-Type', 'application/json')
      .expect(404);

    expect(mockOrganizationServiceInstance.updateOrganization).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({ name: 'New', updatedByUserId: userId })
    );
  });

  it('DELETE /organizations/:id returns 204 when deleted', async () => {
    mockOrganizationServiceInstance.deleteOrganization.mockResolvedValueOnce(undefined);

    const app = await makeApp();
    await request(app)
      .delete(`/organizations/${organizationId}`)
      .set('x-tenant-id', tenantId)
      .set('x-user-id', userId)
      .expect(204);

    expect(mockOrganizationServiceInstance.deleteOrganization).toHaveBeenCalledWith(organizationId);
  });
});

