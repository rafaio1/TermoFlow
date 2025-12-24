import http from 'http';

import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../src/infrastructure/config/config'; // Updated path
import { createApp } from '../src/app';
import { UpstreamDataSourceOptions } from '../src/graphql/datasources/UpstreamDataSource'; // New import
import { fetchJson, postGraphQL, startHttpServer } from './helpers';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    nodeEnv: 'test',
    serviceName: 'termoflow-graphql-middleware-test',
    version: 'test',
    trustProxy: false,
    requestBodyLimit: '1mb',
    corsOrigins: 'none',
    apiKey: undefined,
    rateLimitWindowMs: 60_000,
    rateLimitMax: 10_000,
    enableIntrospection: true,
    maxOperations: 1,
    maxQueryDepth: 10,
    maxQueryFields: 200,
    maxQueryLength: 10_000,
    serverKeepAliveTimeoutMs: 5_000,
    serverHeadersTimeoutMs: 10_000,
    serverRequestTimeoutMs: 30_000,
    upstreamBaseUrl: undefined,
    upstreamHealthPath: '/health',
    upstreamAllowedPathPrefixes: undefined,
    upstreamMaxResponseBytes: 2_000_000,
    upstreamTimeoutMs: 5_000,
    ...overrides,
  };
}

function makeUpstreamDataSourceOptions(overrides: Partial<UpstreamDataSourceOptions> = {}): UpstreamDataSourceOptions {
  return {
    baseUrl: undefined,
    timeoutMs: 5_000,
    allowedPathPrefixes: undefined,
    maxResponseBytes: 2_000_000,
    debug: true,
    ...overrides,
  };
}

async function startUpstreamServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
  getLastHeaders: () => http.IncomingHttpHeaders | undefined;
}> {
  let lastHeaders: http.IncomingHttpHeaders | undefined;

  const server = http.createServer((req, res) => {
    lastHeaders = req.headers;
    res.setHeader('content-type', 'application/json');

    if (req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === '/api/data') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          user: 'alice',
          password: 'secret',
          token: 't0k3n',
          keep: 1,
          drop: 2,
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Unexpected address');
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()));
          }),
        getLastHeaders: () => lastHeaders,
      });
    });
  });
}

async function makeAppWithDependencies(
  config: AppConfig,
  upstreamDataSourceOptions: UpstreamDataSourceOptions,
): Promise<express.Express> {
  return createApp({ config, upstreamDataSourceOptions });
}

describe('app (integration)', () => {
  it('serves health/live/ready', async () => {
    const upstreamServer = await startUpstreamServer();
    const config = makeConfig({ upstreamBaseUrl: upstreamServer.baseUrl });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({
      baseUrl: config.upstreamBaseUrl,
      timeoutMs: config.upstreamTimeoutMs,
      debug: true,
    });

    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const health = await fetchJson(`${server.baseUrl}/health`);
      expect(health.status).toBe(200);
      expect(health.json.ok).toBe(true);

      const live = await fetchJson(`${server.baseUrl}/live`);
      expect(live.status).toBe(200);
      expect(live.json.ok).toBe(true);

      const ready = await fetchJson(`${server.baseUrl}/ready`);
      expect(ready.status).toBe(200);
      expect(ready.json.ok).toBe(true);
      expect(ready.json.upstream.configured).toBe(true);
    } finally {
      await server.close();
      await upstreamServer.close();
    }
  });

  it('rejects non-json content-type for /graphql', async () => {
    const config = makeConfig({ apiKey: undefined });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const res = await fetchJson(`${server.baseUrl}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      });
      expect(res.status).toBe(415);
      expect(res.json.errors?.[0]?.extensions?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    } finally {
      await server.close();
    }
  });

  it('rejects batched GraphQL requests', async () => {
    const config = makeConfig({ apiKey: undefined });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const res = await fetchJson(`${server.baseUrl}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([{ query: '{ health { ok } }' }]),
      });
      expect(res.status).toBe(400);
      expect(res.json.errors?.[0]?.extensions?.code).toBe('BATCH_NOT_SUPPORTED');
    } finally {
      await server.close();
    }
  });

  it('rejects queries above max length', async () => {
    const config = makeConfig({ apiKey: undefined, maxQueryLength: 10 });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const res = await fetchJson(`${server.baseUrl}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ health { ok } }' }),
      });
      expect(res.status).toBe(413);
      expect(res.json.errors?.[0]?.extensions?.code).toBe('QUERY_TOO_LARGE');
    } finally {
      await server.close();
    }
  });

  it('enforces max field count', async () => {
    const config = makeConfig({ apiKey: undefined, maxQueryFields: 1 });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const res = await postGraphQL(server.baseUrl, { query: '{ health { ok } }' });
      expect(res.status).toBe(200);
      expect(res.json.errors?.[0]?.extensions?.code).toBe('QUERY_TOO_COMPLEX');
    } finally {
      await server.close();
    }
  });

  it('enforces max operations per request', async () => {
    const config = makeConfig({ apiKey: undefined, maxOperations: 1 });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const res = await fetchJson(`${server.baseUrl}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operationName: 'A',
          query: 'query A { health { ok } } query B { health { ok } }',
        }),
      });
      expect(res.status).toBe(200);
      expect(res.json.errors?.[0]?.extensions?.code).toBe('TOO_MANY_OPERATIONS');
    } finally {
      await server.close();
    }
  });

  it('protects /graphql with API_KEY when configured', async () => {
    const config = makeConfig({ apiKey: 'test-key' });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const unauthorized = await postGraphQL(server.baseUrl, { query: '{ health { ok } }' });
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.json?.error?.code).toBe('UNAUTHORIZED');

      const ok = await postGraphQL(server.baseUrl, {
        query: '{ health { ok service } }',
        headers: { 'x-api-key': 'test-key' },
      });
      expect(ok.status).toBe(200);
      expect(ok.json.data.health.ok).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('disables introspection when configured', async () => {
    const config = makeConfig({ apiKey: 'test-key', enableIntrospection: false });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const res = await postGraphQL(server.baseUrl, {
        query: '{ __schema { queryType { name } } }',
        headers: { 'x-api-key': 'test-key' },
      });
      expect(res.status).toBe(200);
      expect(res.json.errors?.length).toBeGreaterThan(0);
      expect(String(res.json.errors?.[0]?.message)).toMatch(/introspection/i);
    } finally {
      await server.close();
    }
  });

  it('enforces max query depth', async () => {
    const config = makeConfig({ apiKey: 'test-key', maxQueryDepth: 1 });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({ baseUrl: 'http://mock.upstream' }); // Dummy upstream
    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      const res = await postGraphQL(server.baseUrl, {
        query: '{ health { ok } }',
        headers: { 'x-api-key': 'test-key' },
      });
      expect(res.status).toBe(200);
      expect(res.json.errors?.[0]?.message).toMatch(/depth/i);
    } finally {
      await server.close();
    }
  });

  it('proxies upstreamGet with filtering and safe header forwarding', async () => {
    const upstreamServer = await startUpstreamServer();
    const config = makeConfig({
      apiKey: 'test-key',
      upstreamBaseUrl: upstreamServer.baseUrl,
      upstreamAllowedPathPrefixes: ['/health', '/api'],
    });
    const upstreamDataSourceOptions = makeUpstreamDataSourceOptions({
      baseUrl: config.upstreamBaseUrl,
      timeoutMs: config.upstreamTimeoutMs,
      allowedPathPrefixes: config.upstreamAllowedPathPrefixes,
      debug: true,
    });

    const app = await makeAppWithDependencies(config, upstreamDataSourceOptions);
    const server = await startHttpServer(app);

    try {
      // Gateway auth via Authorization: ApiKey ... should NOT be forwarded to upstream
      await postGraphQL(server.baseUrl, {
        query:
          '{ upstreamGet(path: "/api/data", includeKeys: ["user","password","token","keep"]) }',
        headers: { authorization: 'ApiKey test-key' },
      });
      expect(upstreamServer.getLastHeaders()?.authorization).toBeUndefined();

      // User auth via Authorization: Bearer ... should be forwarded
      const res = await postGraphQL(server.baseUrl, {
        query:
          '{ upstreamGet(path: "/api/data", redactSensitive: true, includeKeys: ["user","password","token","keep"]) }',
        headers: { 'x-api-key': 'test-key', authorization: 'Bearer user-token' },
      });

      expect(res.status).toBe(200);
      expect(res.json.data.upstreamGet).toEqual({
        user: 'alice',
        password: '[REDACTED]',
        token: '[REDACTED]',
        keep: 1,
      });
      expect(upstreamServer.getLastHeaders()?.authorization).toBe('Bearer user-token');
    } finally {
      await server.close();
      await upstreamServer.close();
    }
  });
});
