import { describe, expect, it } from 'vitest';

import { applyJsonFilters, normalizeTopLevelKeys, redactSensitiveFields } from '../src/filter';

describe('filter', () => {
  it('normalizes include/exclude keys', () => {
    expect(normalizeTopLevelKeys([' user ', '', 'ok', '__proto__', 'a.b', 'a_b', 'a-b'])).toEqual([
      'user',
      'ok',
      'a_b',
      'a-b',
    ]);
  });

  it('redacts sensitive keys recursively', () => {
    const input = {
      user: 'alice',
      password: 'secret',
      nested: { token: 'abc', ok: true },
      items: [{ apiKey: 'k1' }, { ok: true }],
    };

    expect(redactSensitiveFields(input)).toEqual({
      user: 'alice',
      password: '[REDACTED]',
      nested: { token: '[REDACTED]', ok: true },
      items: [{ apiKey: '[REDACTED]' }, { ok: true }],
    });
  });

  it('applies redaction then top-level filtering', () => {
    const input = { user: 'alice', password: 'secret', keep: 1, drop: 2 };
    const result = applyJsonFilters({
      value: input,
      redactSensitive: true,
      includeKeys: ['user', 'password', 'keep'],
      excludeKeys: ['keep'],
    });

    expect(result).toEqual({ user: 'alice', password: '[REDACTED]' });
  });
});

