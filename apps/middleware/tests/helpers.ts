import type { Express } from 'express';
import type { AddressInfo } from 'net';

export async function startHttpServer(app: Express): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
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

export async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  return { status: res.status, json };
}

export async function postGraphQL(
  baseUrl: string,
  options: { query: string; variables?: Record<string, unknown>; headers?: Record<string, string> },
): Promise<{ status: number; json: any }> {
  return fetchJson(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: JSON.stringify({ query: options.query, variables: options.variables }),
  });
}

