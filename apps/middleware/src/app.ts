import express from 'express';
import { GraphQLError, NoSchemaIntrospectionCustomRule } from 'graphql';
import { createHandler } from 'graphql-http/lib/use/express';

import type { AppConfig } from './infrastructure/config/config';
import { pickForwardHeaders } from './infrastructure/http/http';
import { schema } from './graphql/schema/schema';
import {
  createDepthLimitRule,
  createFieldCountLimitRule,
  createOperationLimitRule,
} from './security/graphql'; // Updated path
import { createGraphqlFormatError } from './security/graphqlFormat'; // Updated path
import {
  createApiKeyMiddleware,
  createCorsMiddleware,
  createGraphqlRequestGuardMiddleware,
  createHelmetMiddleware,
  createNoCacheMiddleware,
  createRateLimitMiddleware,
  createRequestIdMiddleware,
} from './security/http'; // Updated path
import { createGraphQLContext, GraphQLContext } from './graphql/context'; // New import
import { UpstreamDataSource, UpstreamDataSourceOptions } from './graphql/datasources/UpstreamDataSource'; // New import

interface AppDependencies {
  config: AppConfig;
  upstreamDataSourceOptions: UpstreamDataSourceOptions;
}

export function createApp(dependencies: AppDependencies): express.Express {
  const { config, upstreamDataSourceOptions } = dependencies;

  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.set('trust proxy', config.trustProxy);

  app.use(createRequestIdMiddleware());
  app.use(createHelmetMiddleware());
  app.use(createNoCacheMiddleware());
  app.use(createCorsMiddleware(config));
  app.use(express.json({ limit: config.requestBodyLimit }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: config.serviceName,
      version: config.version,
      time: new Date().toISOString(),
    });
  });

  app.get('/live', (_req, res) => {
    res.json({
      ok: true,
      service: config.serviceName,
      version: config.version,
      time: new Date().toISOString(),
    });
  });

  app.get('/ready', async (req, res) => {
    const now = new Date().toISOString();
    const debug = config.nodeEnv !== 'production';

    if (!config.upstreamBaseUrl) {
      res.status(503).json({
        ok: false,
        service: config.serviceName,
        version: config.version,
        time: now,
        upstream: { configured: false },
      });
      return;
    }

    // Temporarily create UpstreamDataSource directly for ready check
    // In a full DI solution, this could be passed in if needed for this specific check
    const upstreamDataSource = new UpstreamDataSource(upstreamDataSourceOptions);

    try {
      await upstreamDataSource.getJson(config.upstreamHealthPath);
      res.json({
        ok: true,
        service: config.serviceName,
        version: config.version,
        time: now,
        upstream: { configured: true },
      });
    } catch (err) {
      const code =
        err instanceof GraphQLError ? (err.extensions?.code as string | undefined) : undefined;
      res.status(503).json({
        ok: false,
        service: config.serviceName,
        version: config.version,
        time: now,
        upstream: { configured: true },
        error: {
          code: code ?? 'UPSTREAM_UNAVAILABLE',
          ...(debug
            ? { message: err instanceof Error ? err.message : String(err) }
            : { message: 'Upstream is unavailable.' }),
        },
      });
    }
  });

  app.get('/graphql', (_req, res) => {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for /graphql.' } });
  });

  app.post(
    '/graphql',
    createRateLimitMiddleware(config),
    createApiKeyMiddleware(config),
    createGraphqlRequestGuardMiddleware(config),
    (req, res, next) => { // Add this wrapper middleware
      createHandler({
        schema,
        formatError: createGraphqlFormatError(config),
        validationRules: [
          createOperationLimitRule(config.maxOperations),
          createFieldCountLimitRule(config.maxQueryFields),
          createDepthLimitRule(config.maxQueryDepth),
          ...(config.enableIntrospection ? [] : [NoSchemaIntrospectionCustomRule]),
        ],
        context: (request: any, args: Record<string, any>) => createGraphQLContext({
          req: request, // Use the request from graphql-http
          res: res, // Use the response from the express middleware
          config,
          upstreamDataSourceOptions,
        }),
      })(req, res, next); // Call the handler with the express req, res, next
    },
  );

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const debug = config.nodeEnv !== 'production';
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: debug ? (err instanceof Error ? err.message : String(err)) : 'Internal server error.',
        },
      });
    },
  );

  return app;
}
