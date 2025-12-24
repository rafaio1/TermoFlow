import type { RequestHeaders } from 'graphql-http/lib/handler';

const FORWARD_HEADERS = [
  'authorization',
  'x-request-id',
  'x-correlation-id',
  'accept-language',
  'x-tenant-id',
  'x-user-id',
  'x-company-id',
] as const;

const API_KEY_AUTH_RE = /^ApiKey\s+/i;

type HeaderSource = { headers: RequestHeaders };

function readHeader(headers: RequestHeaders, name: string): string | undefined {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    const value = (headers as { get: (key: string) => string | null }).get(name);
    return value ?? undefined;
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function pickForwardHeaders(req: HeaderSource): Record<string, string> {
  const forwarded: Record<string, string> = {};
  for (const headerName of FORWARD_HEADERS) {
    const value = readHeader(req.headers, headerName);
    if (value) forwarded[headerName] = value;
  }

  const auth = forwarded.authorization;
  if (auth && API_KEY_AUTH_RE.test(auth)) {
    delete forwarded.authorization;
  }

  return forwarded;
}
