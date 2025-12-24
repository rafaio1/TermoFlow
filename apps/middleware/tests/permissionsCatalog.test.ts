import { describe, expect, it } from 'vitest';

import { permissionCatalog } from '../src/rbac/permissionsCatalog';

describe('permissionCatalog', () => {
  it('has unique keys', () => {
    const keys = permissionCatalog.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

