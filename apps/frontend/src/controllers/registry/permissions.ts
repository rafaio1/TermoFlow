import { loadRegistryStore } from './store';
import { Permission } from './types';

export function listPermissions(): Permission[] {
  const store = loadRegistryStore();
  return store.permissions.slice().sort((a, b) => a.key.localeCompare(b.key));
}

