const KEY_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SENSITIVE_KEY_PATTERNS = [
  /pass(word|phrase)?/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /api[-_]?key/i,
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isSensitiveKey(key: string): boolean {
  if (BLOCKED_KEYS.has(key)) return true;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function normalizeTopLevelKeys(keys?: readonly string[] | null): string[] | undefined {
  if (!keys?.length) return undefined;
  const normalized = keys
    .map((key) => key.trim())
    .filter(Boolean)
    .slice(0, 50)
    .filter((key) => KEY_NAME_RE.test(key) && !BLOCKED_KEYS.has(key));
  return normalized.length ? normalized : undefined;
}

export function filterTopLevelKeys(
  value: unknown,
  options: { includeKeys?: string[]; excludeKeys?: string[] },
): unknown {
  if (!isPlainObject(value)) return value;

  const includeKeys = options.includeKeys?.length ? new Set(options.includeKeys) : undefined;
  const excludeKeys = options.excludeKeys?.length ? new Set(options.excludeKeys) : undefined;

  const filtered: Record<string, unknown> = Object.create(null);
  for (const [key, val] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key)) continue;
    if (includeKeys && !includeKeys.has(key)) continue;
    if (excludeKeys && excludeKeys.has(key)) continue;
    filtered[key] = val;
  }
  return filtered;
}

export function redactSensitiveFields(value: unknown, maxDepth = 20): unknown {
  const visited = new WeakSet<object>();

  function walk(input: unknown, depth: number): unknown {
    if (depth > maxDepth) return '[Truncated]';
    if (!input || typeof input !== 'object') return input;

    if (visited.has(input)) return '[Circular]';
    visited.add(input);

    if (Array.isArray(input)) {
      return input.map((item) => walk(item, depth + 1));
    }

    if (!isPlainObject(input)) return input;

    const out: Record<string, unknown> = Object.create(null);
    for (const [key, val] of Object.entries(input)) {
      if (isSensitiveKey(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = walk(val, depth + 1);
      }
    }
    return out;
  }

  return walk(value, 0);
}

export function applyJsonFilters(options: {
  value: unknown;
  redactSensitive: boolean;
  includeKeys?: string[];
  excludeKeys?: string[];
}): unknown {
  let result = options.value;
  if (options.redactSensitive) result = redactSensitiveFields(result);
  if (options.includeKeys?.length || options.excludeKeys?.length) {
    result = filterTopLevelKeys(result, {
      includeKeys: options.includeKeys,
      excludeKeys: options.excludeKeys,
    });
  }
  return result;
}
