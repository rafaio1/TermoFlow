import request from 'supertest';

describe('GET /health', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  async function makeApp(postgresOk: boolean, mongoOk: boolean) {
    jest.doMock('../../src/infrastructure/database/postgres', () => ({
      postgres: {
        $queryRaw: postgresOk
          ? jest.fn().mockResolvedValue(1)
          : jest.fn().mockRejectedValue(new Error('pg down')),
      },
    }));

    jest.doMock('../../src/infrastructure/database/mongo', () => ({
      getMongoDb: () => ({
        command: mongoOk
          ? jest.fn().mockResolvedValue({ ok: 1 })
          : jest.fn().mockRejectedValue(new Error('mongo down')),
      }),
    }));

    const mod = await import('../../src/app');
    // The postgres client is mocked globally by jest.doMock at the top.
    // We need to re-import it to get the mocked version for dependencies.
    const { postgres } = await import('../../src/infrastructure/database/postgres');

    // Mocks for controllers, as they are not relevant for health check but required by createApp
    const mockedItemController = {
        getItems: jest.fn(),
        createItem: jest.fn(),
    };
    const mockedOrganizationController = {
        getOrganizations: jest.fn(),
        createOrganization: jest.fn(),
        updateOrganization: jest.fn(),
        deleteOrganization: jest.fn(),
    };

    return mod.createApp({
        postgres: postgres as any,
        itemController: mockedItemController as any,
        organizationController: mockedOrganizationController as any,
    });
  }

  it('returns 200 when Postgres and Mongo are ok', async () => {
    const app = await makeApp(true, true);
    const res = await request(app).get('/health').expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      postgres: { status: 'ok' },
      mongo: { status: 'ok' },
    });
  });

  it('returns 503 when Postgres is down', async () => {
    const app = await makeApp(false, true);
    const res = await request(app).get('/health').expect(503);

    expect(res.body.status).toBe('degraded');
    expect(res.body.postgres.status).toBe('error');
    expect(res.body.mongo.status).toBe('ok');
  });

  it('returns 503 when Mongo is down', async () => {
    const app = await makeApp(true, false);
    const res = await request(app).get('/health').expect(503);

    expect(res.body.status).toBe('degraded');
    expect(res.body.postgres.status).toBe('ok');
    expect(res.body.mongo.status).toBe('error');
  });
});

