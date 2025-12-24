import { GraphQLError } from 'graphql';
import type { FormatError } from 'graphql-http';

import type { AppConfig } from '../infrastructure/config/config';

const EXTENSION_ALLOWLIST_BY_CODE: Record<string, readonly string[]> = {
  QUERY_TOO_DEEP: ['maxDepth', 'depth'],
  QUERY_TOO_COMPLEX: ['maxFields', 'fieldCount'],
  TOO_MANY_OPERATIONS: ['maxOperations', 'operationCount'],
  INVALID_PATH: [],
  PATH_NOT_ALLOWED: ['allowedPathPrefixes'],
  UPSTREAM_NOT_CONFIGURED: [],
  UPSTREAM_TIMEOUT: [],
  UPSTREAM_RESPONSE_TOO_LARGE: ['maxBytes'],
  UPSTREAM_REDIRECT_NOT_ALLOWED: ['status', 'location'],
  UPSTREAM_ERROR: ['http'],
};

function sanitizeExtensions(extensions: unknown): Record<string, unknown> | undefined {
  if (!extensions || typeof extensions !== 'object') return undefined;
  const record = extensions as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : undefined;
  if (!code) return undefined;

  const allow = EXTENSION_ALLOWLIST_BY_CODE[code] ?? [];
  const out: Record<string, unknown> = { code };
  for (const key of allow) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  return out;
}

export function createGraphqlFormatError(config: AppConfig): FormatError {
  const isProd = config.nodeEnv === 'production';

  return (err) => {
    if (!isProd) return err;

    const gqlErr = err instanceof GraphQLError ? err : new GraphQLError('Internal server error.', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });

    const isWrappedInternal =
      gqlErr.originalError != null && !(gqlErr.originalError instanceof GraphQLError);

    if (isWrappedInternal) {
      return new GraphQLError('Internal server error.', {
        nodes: gqlErr.nodes,
        source: gqlErr.source,
        positions: gqlErr.positions,
        path: gqlErr.path,
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }

    return new GraphQLError(gqlErr.message, {
      nodes: gqlErr.nodes,
      source: gqlErr.source,
      positions: gqlErr.positions,
      path: gqlErr.path,
      extensions: sanitizeExtensions(gqlErr.extensions),
    });
  };
}

