import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../logging/logger';

export const postgres = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
    ...(env.NODE_ENV !== 'production' ? ([{ emit: 'event', level: 'query' }] as const) : []),
  ] satisfies Prisma.LogDefinition[],
});

postgres.$on('warn', (event) => {
  logger.warn({ message: event.message }, 'Prisma warn');
});

postgres.$on('error', (event) => {
  logger.error({ message: event.message }, 'Prisma error');
});

if (env.NODE_ENV !== 'production') {
  postgres.$on('query', (event) => {
    logger.debug(
      { query: event.query, params: event.params, durationMs: event.duration },
      'Prisma query',
    );
  });
}

export async function connectPostgres() {
  await postgres.$connect();
}

export async function disconnectPostgres() {
  await postgres.$disconnect();
}
