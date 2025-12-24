import 'dotenv/config';
import { createApp } from './app';
import { env } from './infrastructure/config/env'; // Updated path
import { connectMongo, disconnectMongo, getMongoDb } from './infrastructure/database/mongo'; // Updated path
import { connectPostgres, disconnectPostgres, postgres } from './infrastructure/database/postgres'; // Updated path
import { logger } from './infrastructure/logging/logger'; // Updated path
import { retry } from './infrastructure/utils/retry'; // Updated path

// Import Repositories
import { PrismaTenantRepository } from './infrastructure/database/repositories/postgres/TenantRepository';
import { PrismaUserRepository } from './infrastructure/database/repositories/postgres/UserRepository';
import { PrismaOrganizationRepository } from './infrastructure/database/repositories/postgres/OrganizationRepository';
import { PrismaCompanyRepository } from './infrastructure/database/repositories/postgres/CompanyRepository';
import { PrismaItemRepository } from './infrastructure/database/repositories/postgres/ItemRepository';

// Import Services
import { TenantService } from './core/application/services/TenantService';
import { UserService } from './core/application/services/UserService';
import { OrganizationService } from './core/application/services/OrganizationService';
import { CompanyService } from './core/application/services/CompanyService';
import { ItemService } from './core/application/services/ItemService';

// Import Controllers
import { ItemController } from './infrastructure/web/controllers/ItemController';
import { OrganizationController } from './infrastructure/web/controllers/OrganizationController';

async function main() {
  await retry(connectPostgres, {
    label: 'Postgres connect',
    retries: env.DB_CONNECT_RETRIES,
    delayMs: env.DB_CONNECT_RETRY_DELAY_MS,
  });

  await retry(connectMongo, {
    label: 'Mongo connect',
    retries: env.DB_CONNECT_RETRIES,
    delayMs: env.DB_CONNECT_RETRY_DELAY_MS,
  });

  // 1. Instantiate Repositories
  const tenantRepository = new PrismaTenantRepository(postgres);
  const userRepository = new PrismaUserRepository(postgres);
  const organizationRepository = new PrismaOrganizationRepository(postgres);
  const companyRepository = new PrismaCompanyRepository(postgres);
  const itemRepository = new PrismaItemRepository(postgres);

  // 2. Instantiate Services
  const tenantService = new TenantService(tenantRepository);
  const userService = new UserService(userRepository);
  const organizationService = new OrganizationService(organizationRepository);
  const companyService = new CompanyService(companyRepository);
  const itemService = new ItemService(itemRepository);

  // 3. Instantiate Controllers
  const itemController = new ItemController(itemService);
  const organizationController = new OrganizationController(organizationService);

  const app = createApp({
    postgres, // Pass the prisma client for health checks
    itemController,
    organizationController,
    // Pass other controllers as they are refactored
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'HTTP server listening');
  });

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down');

    await Promise.allSettled([disconnectPostgres(), disconnectMongo()]);

    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error while closing server');
        process.exit(1);
      }
      process.exit(0);
    });
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Startup failed');
  process.exit(1);
});
