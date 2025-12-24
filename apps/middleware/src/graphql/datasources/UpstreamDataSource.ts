// apps/middleware/src/graphql/datasources/UpstreamDataSource.ts

import { GraphQLError } from 'graphql';

export interface UpstreamDataSourceOptions {
  baseUrl?: string;
  timeoutMs: number;
  allowedPathPrefixes?: string[];
  maxResponseBytes?: number;
  debug?: boolean;
}

export class UpstreamDataSource {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;
  private readonly allowedPathPrefixes?: string[];
  private readonly maxResponseBytes: number;
  private readonly debug?: boolean;

  constructor(options: UpstreamDataSourceOptions) {
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs;
    this.allowedPathPrefixes = options.allowedPathPrefixes;
    this.maxResponseBytes = options.maxResponseBytes ?? 2_000_000;
    this.debug = options.debug;
  }

  async getJson(path: string, headers: Record<string, string> = {}): Promise<unknown> {
    if (!this.baseUrl) {
      throw new GraphQLError('UPSTREAM_BASE_URL is not configured.', {
        extensions: { code: 'UPSTREAM_NOT_CONFIGURED' },
      });
    }

    const safePath = this.validatePath(path, this.allowedPathPrefixes);
    const url = new URL(safePath, this.baseUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          accept: 'application/json',
          ...headers,
        },
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') ?? '';
      const bodyText = await this.readResponseTextWithLimit(response, {
        maxBytes: this.maxResponseBytes,
        debug: this.debug,
      });

      if (response.status >= 300 && response.status < 400) {
        throw new GraphQLError(`Upstream GET ${safePath} redirected (${response.status}).`, {
          extensions: {
            code: 'UPSTREAM_REDIRECT_NOT_ALLOWED',
            status: response.status,
            ...(this.debug ? { location: response.headers.get('location') } : {}),
          },
        });
      }

      if (!response.ok) {
        throw new GraphQLError(`Upstream GET ${safePath} failed with ${response.status}.`, {
          extensions: {
            code: 'UPSTREAM_ERROR',
            http: { status: response.status },
            ...(this.debug ? { upstream: { body: bodyText.slice(0, 2_000) } } : {}),
          },
        });
      }

      if (contentType.includes('application/json')) {
        if (!bodyText) return null;
        try {
          const parsed = JSON.parse(bodyText) as unknown;
          return this.isPlainObject(parsed) || Array.isArray(parsed) ? parsed : parsed;
        } catch (err) {
          throw new GraphQLError(`Upstream GET ${safePath} returned invalid JSON.`, {
            extensions: {
              code: 'UPSTREAM_INVALID_JSON',
              ...(this.debug ? { cause: err instanceof Error ? err.message : String(err) } : {}),
            },
          });
        }
      }

      return bodyText;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        throw new GraphQLError(`Upstream GET ${safePath} timed out.`, {
          extensions: { code: 'UPSTREAM_TIMEOUT' },
        });
      }

      throw new GraphQLError(`Upstream GET ${safePath} failed.`, {
        extensions: {
          code: 'UPSTREAM_FETCH_FAILED',
          ...(this.debug ? { cause: err instanceof Error ? err.message : String(err) } : {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object') return false;
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  private parseContentLength(value: string | null): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    return parsed;
  }

  private async readResponseTextWithLimit(
    response: Response,
    options: { maxBytes: number; debug?: boolean },
  ): Promise<string> {
    const contentLength = this.parseContentLength(response.headers.get('content-length'));
    if (contentLength != null && contentLength > options.maxBytes) {
      throw new GraphQLError(`Upstream response too large (${contentLength} bytes).`, {
        extensions: { code: 'UPSTREAM_RESPONSE_TOO_LARGE', maxBytes: options.maxBytes },
      });
    }

    if (!response.body) return '';

    let totalBytes = 0;
    const chunks: Uint8Array[] = [];

    try {
      // `response.body` is a web ReadableStream in Node.js fetch.
      for await (const chunk of response.body as any) {
        const bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);
        totalBytes += bytes.byteLength;
        if (totalBytes > options.maxBytes) {
          throw new GraphQLError(`Upstream response exceeded ${options.maxBytes} bytes.`, {
            extensions: { code: 'UPSTREAM_RESPONSE_TOO_LARGE', maxBytes: options.maxBytes },
          });
        }
        chunks.push(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      }
    } catch (err) {
      try {
        await response.body.cancel();
      } catch {
        // ignore
      }
      throw err;
    }

    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
  }

  private validatePath(path: string, allowedPathPrefixes?: readonly string[]): string {
    const trimmed = path.trim();
    if (!trimmed.startsWith('/')) {
      throw new GraphQLError('`path` must start with `/` (example: `/api/v1/users`).', {
        extensions: { code: 'INVALID_PATH' },
      });
    }
    if (trimmed.startsWith('//') || trimmed.includes('://') || trimmed.includes('\\')) {
      throw new GraphQLError('`path` must be a relative path (no protocol/host).', {
        extensions: { code: 'INVALID_PATH' },
      });
    }

    const [pathname] = trimmed.split('?', 1);
    if (pathname.split('/').some((segment) => segment === '..')) {
      throw new GraphQLError('`path` must not contain `..` segments.', {
        extensions: { code: 'INVALID_PATH' },
      });
    }

    if (allowedPathPrefixes?.length) {
      const allowed = allowedPathPrefixes.some((prefix) => trimmed.startsWith(prefix));
      if (!allowed) {
        throw new GraphQLError('`path` is not allowed by UPSTREAM_ALLOWED_PATH_PREFIXES.', {
          extensions: {
            code: 'PATH_NOT_ALLOWED',
            allowedPathPrefixes: allowedPathPrefixes,
          },
        });
      }
    }

    return trimmed;
  }
}
