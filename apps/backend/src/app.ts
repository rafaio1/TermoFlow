import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { getMongoDb } from './infrastructure/database/mongo'; // Updated path
import { logger } from './infrastructure/logging/logger'; // Updated path

import { ItemController } from './infrastructure/web/controllers/ItemController';
import { OrganizationController } from './infrastructure/web/controllers/OrganizationController';
import createItemsRouter from './infrastructure/web/routes/items'; // Updated path
import createOrganizationsRouter from './infrastructure/web/routes/organizations'; // Updated path

interface AppDependencies {
  postgres: PrismaClient;
  itemController: ItemController;
  organizationController: OrganizationController;
  // Add other controllers as they are refactored
}

export function createApp(dependencies: AppDependencies) {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => {
        const header = req.headers['x-request-id'];
        if (typeof header === 'string' && header.length > 0) return header;
        if (Array.isArray(header) && typeof header[0] === 'string' && header[0].length > 0)
          return header[0];
        return randomUUID();
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    res.json({ service: 'termoflow-backend', status: 'ok' });
  });

  app.get('/health', async (_req, res) => {
    const [postgresCheck, mongoCheck] = await Promise.allSettled([
      dependencies.postgres.$queryRaw`SELECT 1`,
      getMongoDb().command({ ping: 1 }),
    ]);

    const postgresOk = postgresCheck.status === 'fulfilled';
    const mongoOk = mongoCheck.status === 'fulfilled';
    const ok = postgresOk && mongoOk;

    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      postgres: postgresOk
        ? { status: 'ok' }
        : { status: 'error', error: String(postgresCheck.reason) },
      mongo: mongoOk ? { status: 'ok' } : { status: 'error', error: String(mongoCheck.reason) },
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/items', createItemsRouter(dependencies.itemController));
  app.use('/organizations', createOrganizationsRouter(dependencies.organizationController));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation Error', details: err.flatten() });
      return;
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        res.status(409).json({ error: 'Conflict' });
        return;
      }
      if (err.code === 'P2003') {
        res.status(400).json({ error: 'Invalid Reference' });
        return;
      }
      if (err.code === 'P2025') {
        res.status(404).json({ error: 'Not Found' });
        return;
      }
    }

    req.log?.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
