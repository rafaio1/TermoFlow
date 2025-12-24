import { loadRegistryStore } from './store';
import { actAsUser, createUser } from './users';
import { createRole, setRolePermissions } from './roles';

describe('registry RBAC controllers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('enforce UNIQUE(tenant_id, email) on users', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;

    createUser(tenantId, { email: 'Test@Example.com', name: 'Test', status: 'ACTIVE' });

    expect(() => createUser(tenantId, { email: 'test@example.com', name: 'Other' })).toThrow(
      'user_email_already_exists'
    );
  });

  it('enforce UNIQUE(tenant_id, name) on roles', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;

    createRole(tenantId, { name: 'Financeiro', scope: 'TENANT' });

    expect(() => createRole(tenantId, { name: 'financeiro', scope: 'TENANT' })).toThrow('role_name_already_exists');
  });

  it('reject unknown permissions in role_permissions', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const role = createRole(tenantId, { name: 'Viewer', scope: 'TENANT' });

    expect(() => setRolePermissions(tenantId, role.id, ['permission-does-not-exist'])).toThrow('permission_not_found');
  });

  it('actAsUser updates lastLoginAt and currentUserId', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const user = createUser(tenantId, { email: 'a@a.com', name: 'A', status: 'INVITED' });

    actAsUser(tenantId, user.id);

    const after = loadRegistryStore();
    const updatedUser = after.users.find(u => u.id === user.id);

    expect(after.ui.currentUserId).toBe(user.id);
    expect(updatedUser).toBeDefined();
    if (!updatedUser) throw new Error('expected_user_to_exist');
    expect(updatedUser.lastLoginAt).not.toBeNull();
    expect(updatedUser.status).toBe('ACTIVE');
  });
});
