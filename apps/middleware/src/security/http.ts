import crypto from 'crypto';

import cors, { type CorsOptions } from 'cors';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import type { AppConfig } from '../infrastructure/config/config';

function parseApiKeyAuthorization(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = /^ApiKey\s+(.+)$/i.exec(trimmed);
  return match?.[1]?.trim() || undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  return Object.prototype.toString.call(value) === '[object Object]';
}

function sendGraphqlStyleError(
  res: Parameters<RequestHandler>[1],
  options: { status: number; code: string; message: string; extensions?: Record<string, unknown> },
): void {
  res.status(options.status).json({
    errors: [
      {
        message: options.message,
        extensions: { code: options.code, ...(options.extensions ?? {}) },
      },
    ],
  });
}

export function createRequestIdMiddleware(): RequestHandler {
  return (req, res, next) => {
    const existing = req.header('x-request-id');
    const requestId = existing ?? crypto.randomUUID();

    if (!existing) {
      req.headers['x-request-id'] = requestId;
    }
    res.setHeader('x-request-id', requestId);

    next();
  };
}

export function createHelmetMiddleware(): RequestHandler {
  return helmet();
}

export function createCorsMiddleware(config: AppConfig): RequestHandler {
  const origins = config.corsOrigins;

  const options: CorsOptions =
    origins === 'all'
      ? { origin: '*' }
      : origins === 'none'
        ? { origin: false }
        : {
            origin: (origin, callback) => {
              if (!origin) return callback(null, true);
              if (origins.includes(origin)) return callback(null, true);
              return callback(null, false);
            },
          };

  return cors(options);
}

export function createRateLimitMiddleware(config: AppConfig): RequestHandler {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
  });
}

export function createApiKeyMiddleware(config: AppConfig): RequestHandler {
  if (!config.apiKey) return (_req, _res, next) => next();

  const expected = Buffer.from(config.apiKey);

  return (req, res, next) => {
    const headerValue = req.header('x-api-key');
    const authValue = parseApiKeyAuthorization(req.header('authorization'));
    const provided = headerValue ?? authValue;

    if (provided) {
      const actual = Buffer.from(provided);
      if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
        next();
        return;
      }
    }

    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key.' } });
  };
}

export function createNoCacheMiddleware(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('cache-control', 'no-store');
    next();
  };
}

export function createGraphqlRequestGuardMiddleware(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for /graphql.' } });
      return;
    }

    if (!req.is('application/json')) {
      sendGraphqlStyleError(res, {
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json.',
      });
      return;
    }

    if (Array.isArray(req.body)) {
      sendGraphqlStyleError(res, {
        status: 400,
        code: 'BATCH_NOT_SUPPORTED',
        message: 'Batched GraphQL requests are not supported.',
      });
      return;
    }

    if (!isPlainObject(req.body)) {
      sendGraphqlStyleError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Invalid GraphQL request body.',
      });
      return;
    }

    const query = req.body.query;
    if (typeof query !== 'string') {
      sendGraphqlStyleError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: '`query` must be a string.',
      });
      return;
    }

    if (query.length > config.maxQueryLength) {
      sendGraphqlStyleError(res, {
        status: 413,
        code: 'QUERY_TOO_LARGE',
        message: 'Query is too large.',
        extensions: { maxQueryLength: config.maxQueryLength, queryLength: query.length },
      });
      return;
    }

    const variables = req.body.variables;
    if (variables != null && !isPlainObject(variables)) {
      sendGraphqlStyleError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: '`variables` must be an object.',
      });
      return;
    }

    const operationName = req.body.operationName;
    if (operationName != null && typeof operationName !== 'string') {
      sendGraphqlStyleError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: '`operationName` must be a string.',
      });
      return;
    }

    next();
  };
}
