import { PrismaClient } from '@prisma/client';

import { permissionCatalog } from '../src/rbac/permissionsCatalog';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const permission of permissionCatalog) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
    });
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

