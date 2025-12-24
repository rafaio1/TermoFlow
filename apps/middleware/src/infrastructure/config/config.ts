export type AppConfig = {
  port: number;
  nodeEnv: string;
  serviceName: string;
  version: string;
  trustProxy: boolean;
  requestBodyLimit: string;
  corsOrigins: 'all' | 'none' | string[];
  apiKey?: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  enableIntrospection: boolean;
  maxOperations: number;
  maxQueryDepth: number;
  maxQueryFields: number;
  maxQueryLength: number;
  serverKeepAliveTimeoutMs: number;
  serverHeadersTimeoutMs: number;
  serverRequestTimeoutMs: number;
  upstreamBaseUrl?: string;
  upstreamHealthPath: string;
  upstreamAllowedPathPrefixes?: string[];
  upstreamMaxResponseBytes: number;
  upstreamTimeoutMs: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseCsv(value: string | undefined): string[] | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const items = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function parseCorsOrigins(value: string | undefined, nodeEnv: string): AppConfig['corsOrigins'] {
  if (value == null) return nodeEnv === 'production' ? 'none' : 'all';
  const trimmed = value.trim();
  if (!trimmed) return nodeEnv === 'production' ? 'none' : 'all';
  if (trimmed === '*' || trimmed.toLowerCase() === 'all') return 'all';
  if (trimmed.toLowerCase() === 'none') return 'none';
  return parseCsv(trimmed) ?? (nodeEnv === 'production' ? 'none' : 'all');
}

function normalizePathPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed.startsWith('/')) return `/${trimmed}`;
  return trimmed;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';

  const serverHeadersTimeoutMs = parsePositiveInt(env.SERVER_HEADERS_TIMEOUT_MS, 10_000);
  const serverKeepAliveTimeoutMs = parsePositiveInt(env.SERVER_KEEP_ALIVE_TIMEOUT_MS, 5_000);
  const parsedRequestTimeoutMs = parsePositiveInt(env.SERVER_REQUEST_TIMEOUT_MS, 30_000);
  const serverRequestTimeoutMs = Math.max(parsedRequestTimeoutMs, serverHeadersTimeoutMs + 1000);

  return {
    port: parsePositiveInt(env.PORT, 4000),
    nodeEnv,
    serviceName: env.SERVICE_NAME ?? 'termoflow-graphql-middleware',
    version: env.APP_VERSION ?? env.SERVICE_VERSION ?? env.npm_package_version ?? '0.0.0',
    trustProxy: parseBoolean(env.TRUST_PROXY, false),
    requestBodyLimit: env.REQUEST_BODY_LIMIT?.trim() || '1mb',
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS, nodeEnv),
    apiKey: normalizeOptionalString(env.API_KEY),
    rateLimitWindowMs: parsePositiveInt(env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: parsePositiveInt(env.RATE_LIMIT_MAX, 120),
    enableIntrospection: parseBoolean(env.ENABLE_INTROSPECTION, nodeEnv !== 'production'),
    maxOperations: parsePositiveInt(env.MAX_OPERATIONS, 1),
    maxQueryDepth: parsePositiveInt(env.MAX_QUERY_DEPTH, 10),
    maxQueryFields: parsePositiveInt(env.MAX_QUERY_FIELDS, 200),
    maxQueryLength: parsePositiveInt(env.MAX_QUERY_LENGTH, 10_000),
    serverKeepAliveTimeoutMs: Math.min(serverKeepAliveTimeoutMs, serverHeadersTimeoutMs),
    serverHeadersTimeoutMs,
    serverRequestTimeoutMs,
    upstreamBaseUrl: normalizeOptionalString(env.UPSTREAM_BASE_URL),
    upstreamHealthPath: env.UPSTREAM_HEALTH_PATH?.trim() || '/health',
    upstreamAllowedPathPrefixes: parseCsv(env.UPSTREAM_ALLOWED_PATH_PREFIXES)?.map(normalizePathPrefix),
    upstreamMaxResponseBytes: parsePositiveInt(env.UPSTREAM_MAX_RESPONSE_BYTES, 2_000_000),
    upstreamTimeoutMs: parsePositiveInt(env.UPSTREAM_TIMEOUT_MS, 10_000),
  };
}
