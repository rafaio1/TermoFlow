import { loadRegistryStore } from './store';
import { createCompany } from './companies';
import { createEmployee } from './employees';
import { getAllowedCompanyIdsForUser } from './access';
import { createJobFunction } from './jobFunctions';
import { createRole } from './roles';
import { createUser } from './users';
import { upsertUserCompanyMembership, removeUserCompanyMembership } from './userCompanyMemberships';
import { createUserRoleAssignment } from './userRoleAssignments';

describe('registry visibility + memberships', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps a single default company membership per user', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const company1Id = store.companies[0].id;

    const company2 = createCompany(tenantId, { tradeName: 'Empresa 2', code: 'C2' });
    const user = createUser(tenantId, { email: 'user@demo.local', name: 'User', status: 'ACTIVE' });

    upsertUserCompanyMembership(tenantId, user.id, company1Id, { status: 'ACTIVE', isDefault: true });
    upsertUserCompanyMembership(tenantId, user.id, company2.id, { status: 'ACTIVE', isDefault: true });

    const after = loadRegistryStore();
    const memberships = after.userCompanyMemberships.filter(m => m.tenantId === tenantId && m.userId === user.id);
    const defaults = memberships.filter(m => m.isDefault && m.status === 'ACTIVE');

    expect(defaults).toHaveLength(1);
    expect(defaults[0].companyId).toBe(company2.id);
  });

  it('re-picks a default if the default membership is removed', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const company1Id = store.companies[0].id;

    const company2 = createCompany(tenantId, { tradeName: 'Empresa 2', code: 'C2' });
    const user = createUser(tenantId, { email: 'user@demo.local', name: 'User', status: 'ACTIVE' });

    upsertUserCompanyMembership(tenantId, user.id, company1Id, { status: 'ACTIVE', isDefault: false });
    upsertUserCompanyMembership(tenantId, user.id, company2.id, { status: 'ACTIVE', isDefault: true });

    removeUserCompanyMembership(tenantId, user.id, company2.id);

    const after = loadRegistryStore();
    const memberships = after.userCompanyMemberships.filter(m => m.tenantId === tenantId && m.userId === user.id);
    const defaults = memberships.filter(m => m.isDefault && m.status === 'ACTIVE');

    expect(defaults).toHaveLength(1);
    expect(defaults[0].companyId).toBe(company1Id);
  });

  it('enforces role scope rules in user_role_assignments', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const companyId = store.companies[0].id;

    const user = createUser(tenantId, { email: 'user@demo.local', name: 'User', status: 'ACTIVE' });

    const companyRole = createRole(tenantId, { name: 'Company Viewer', scope: 'COMPANY' });
    expect(() =>
      createUserRoleAssignment(tenantId, { userId: user.id, roleId: companyRole.id })
    ).toThrow('scope_company_id_required');

    createUserRoleAssignment(tenantId, { userId: user.id, roleId: companyRole.id, scopeCompanyId: companyId });

    const tenantRole = createRole(tenantId, { name: 'Tenant Viewer', scope: 'TENANT' });
    expect(() =>
      createUserRoleAssignment(tenantId, {
        userId: user.id,
        roleId: tenantRole.id,
        scopeCompanyId: companyId
      })
    ).toThrow('invalid_role_scope');
  });

  it('computes allowed companies based on memberships + scoped roles', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const company1Id = store.companies[0].id;

    const company2 = createCompany(tenantId, { tradeName: 'Empresa 2', code: 'C2' });
    const user = createUser(tenantId, { email: 'user@demo.local', name: 'User', status: 'ACTIVE' });

    const companyRole = createRole(tenantId, { name: 'Company Viewer', scope: 'COMPANY' });
    createUserRoleAssignment(tenantId, { userId: user.id, roleId: companyRole.id, scopeCompanyId: company2.id });

    upsertUserCompanyMembership(tenantId, user.id, company1Id, { status: 'ACTIVE', isDefault: true });

    const allowed = getAllowedCompanyIdsForUser(tenantId, user.id).sort();
    expect(allowed).toEqual([company1Id, company2.id].sort());
  });

  it('enforces employee document uniqueness per tenant', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;
    const companyId = store.companies[0].id;

    createEmployee(tenantId, { companyId, name: 'Fulano', document: '123.456.789-00' });

    expect(() => createEmployee(tenantId, { companyId, name: 'Ciclano', document: '12345678900' })).toThrow(
      'employee_document_already_exists'
    );
  });

  it('enforces job function code uniqueness per tenant', () => {
    const store = loadRegistryStore();
    const tenantId = store.tenants[0].id;

    createJobFunction(tenantId, { name: 'Financeiro', code: 'FIN' });
    expect(() => createJobFunction(tenantId, { name: 'Financeiro 2', code: 'fin' })).toThrow(
      'job_function_code_already_exists'
    );
  });
});

