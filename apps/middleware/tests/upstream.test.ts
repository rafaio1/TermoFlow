import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { createUpstreamClient } from '../src/upstream';

import http from 'http';

async function startUpstreamServer(handler: http.RequestListener): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer(handler);
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
      });
    });
  });
}

describe('upstream client', () => {
  it('rejects non-relative paths', async () => {
    const client = createUpstreamClient({ baseUrl: 'http://example.com', timeoutMs: 1000 });
    await expect(client.getJson('http://evil.test')).rejects.toBeInstanceOf(GraphQLError);
    await expect(client.getJson('//evil.test')).rejects.toBeInstanceOf(GraphQLError);
  });

  it('enforces allowed path prefixes', async () => {
    const client = createUpstreamClient({
      baseUrl: 'http://example.com',
      timeoutMs: 1000,
      allowedPathPrefixes: ['/api'],
    });

    try {
      await client.getJson('/health');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
      const gqlErr = err as GraphQLError;
      expect(gqlErr.extensions?.code).toBe('PATH_NOT_ALLOWED');
    }
  });

  it('does not follow redirects', async () => {
    const upstream = await startUpstreamServer((req, res) => {
      if (req.url === '/health') {
        res.statusCode = 302;
        res.setHeader('location', 'http://example.com/evil');
        res.end();
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    const client = createUpstreamClient({ baseUrl: upstream.baseUrl, timeoutMs: 1000, debug: true });
    try {
      await client.getJson('/health');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
      const gqlErr = err as GraphQLError;
      expect(gqlErr.extensions?.code).toBe('UPSTREAM_REDIRECT_NOT_ALLOWED');
    } finally {
      await upstream.close();
    }
  });

  it('enforces upstream max response bytes', async () => {
    const upstream = await startUpstreamServer((req, res) => {
      if (req.url === '/big') {
        const payload = JSON.stringify({ data: 'x'.repeat(200) });
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.setHeader('content-length', Buffer.byteLength(payload));
        res.end(payload);
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    const client = createUpstreamClient({
      baseUrl: upstream.baseUrl,
      timeoutMs: 1000,
      maxResponseBytes: 50,
    });
    try {
      await client.getJson('/big');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
      const gqlErr = err as GraphQLError;
      expect(gqlErr.extensions?.code).toBe('UPSTREAM_RESPONSE_TOO_LARGE');
    } finally {
      await upstream.close();
    }
  });
});
