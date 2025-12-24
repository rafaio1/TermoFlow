import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, Space, Tabs, Typography } from 'antd';
import PageHeader from '../../shared/components/PageHeader';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPermissionKeysForUser } from '@utils/access';

import {
  UUID,
  getTenantSettings,
  listAuditLogs,
  listCompanies,
  listCustomersVisibleToCompany,
  listEmployees,
  listGroups,
  listJobFunctions,
  listOrganizations,
  listPermissions,
  listRoles,
  listSuppliersVisibleToCompany,
  listTenants,
  listUserCompanyMemberships,
  listUserRoleAssignments,
  listUsers,
  loadRegistryStore,
  setCurrentCompanyId,
  setCurrentTenantId
} from '../../controllers/registry';

import AuditTab from './AuditTab';
import CoaTab from './CoaTab';
import CompaniesTab from './CompaniesTab';
import CustomersTab from './CustomersTab';
import EmployeesTab from './EmployeesTab';
import FinanceTitlesTab from './FinanceTitlesTab';
import GroupsTab from './GroupsTab';
import JobFunctionsTab from './JobFunctionsTab';
import OrganizationsTab from './OrganizationsTab';
import PermissionsTab from './PermissionsTab';
import RolesTab from './RolesTab';
import SuppliersTab from './SuppliersTab';
import TenantSettingsTab from './TenantSettingsTab';
import TenantsTab from './TenantsTab';
import UserAccessTab from './UserAccessTab';
import UsersTab from './UsersTab';

import './Registry.less';

const { Text } = Typography;

export default function Registry() {
  const location = useLocation();
  const navigate = useNavigate();
  const [storeState, setStoreState] = useState(() => loadRegistryStore());
  const refresh = () => setStoreState(loadRegistryStore());

  const requestedTabKey = useMemo(() => new URLSearchParams(location.search).get('tab'), [location.search]);
  const tenants = useMemo(() => listTenants(), [storeState]);
  const firstTenantId = tenants.length > 0 ? tenants[0].id : null;
  const currentTenantId = storeState.ui.currentTenantId || firstTenantId;
  const currentTenant = useMemo(
    () => (currentTenantId ? tenants.find(t => t.id === currentTenantId) || null : null),
    [tenants, currentTenantId]
  );

  const tenantSettings = useMemo(() => {
    if (!currentTenantId) return null;
    return getTenantSettings(currentTenantId);
  }, [storeState, currentTenantId]);

  const canUseOrganizations = !!(tenantSettings && tenantSettings.useOrganizations);
  const canUseGroups = !!(tenantSettings && tenantSettings.useGroups);

  const permissionKeys = useMemo(() => {
    if (!currentTenantId) return new Set<string>();
    if (!storeState.ui.currentUserId) return new Set<string>();
    return getPermissionKeysForUser(storeState, currentTenantId, storeState.ui.currentUserId);
  }, [currentTenantId, storeState]);
  const hasAnyPermission = (keys: string[]) => keys.some(key => permissionKeys.has(key));

  const canManageTenants = hasAnyPermission(['registry.tenants.read', 'registry.tenants.write']);
  const canManageTenantSettings = hasAnyPermission(['registry.tenants.write']);
  const canManageOrganizations = canUseOrganizations && hasAnyPermission(['registry.organizations.read', 'registry.organizations.write']);
  const canManageGroups = canUseGroups && hasAnyPermission(['registry.groups.read', 'registry.groups.write']);
  const canManageCompanies = hasAnyPermission(['registry.companies.read', 'registry.companies.write']);
  const canManageCustomers = hasAnyPermission(['customers.read', 'customers.write']);
  const canManageSuppliers = hasAnyPermission(['suppliers.read', 'suppliers.write']);
  const canManagePayables = hasAnyPermission(['finance.ap.read', 'finance.ap.write']);
  const canManageReceivables = hasAnyPermission(['finance.ar.read', 'finance.ar.write']);
  const canManageUsers = hasAnyPermission(['rbac.users.read', 'rbac.users.write']);
  const canManageRoles = hasAnyPermission(['rbac.roles.read', 'rbac.roles.write']);
  const canManageJobFunctions = hasAnyPermission(['registry.job_functions.read', 'registry.job_functions.write']);
  const canManageEmployees = hasAnyPermission(['registry.employees.read', 'registry.employees.write']);
  const canReadPermissionsCatalog = hasAnyPermission(['rbac.permissions.read']);
  const canManageCoa = hasAnyPermission(['registry.coa.read', 'registry.coa.write']);
  const canReadAudit = hasAnyPermission(['registry.audit.read']);

  const organizations = useMemo(
    () => (currentTenantId ? listOrganizations(currentTenantId) : []),
    [storeState, currentTenantId]
  );
  const groups = useMemo(() => (currentTenantId ? listGroups(currentTenantId) : []), [storeState, currentTenantId]);
  const companies = useMemo(
    () => (currentTenantId ? listCompanies(currentTenantId) : []),
    [storeState, currentTenantId]
  );
  const companyGroups = useMemo(
    () => (currentTenantId ? storeState.companyGroups.filter(cg => cg.tenantId === currentTenantId) : []),
    [storeState, currentTenantId]
  );

  const storedCompanyId = storeState.ui.currentCompanyId;
  const currentCompanyId =
    storedCompanyId && companies.some(c => c.id === storedCompanyId) ? storedCompanyId : companies[0] ? companies[0].id : null;
  const auditLogs = useMemo(() => (currentTenantId ? listAuditLogs(currentTenantId) : []), [storeState, currentTenantId]);

  const users = useMemo(() => (currentTenantId ? listUsers(currentTenantId) : []), [storeState, currentTenantId]);
  const roles = useMemo(() => (currentTenantId ? listRoles(currentTenantId) : []), [storeState, currentTenantId]);
  const permissions = useMemo(() => listPermissions(), [storeState]);
  const rolePermissions = useMemo(
    () => (currentTenantId ? storeState.rolePermissions.filter(rp => rp.tenantId === currentTenantId) : []),
    [storeState, currentTenantId]
  );
  const memberships = useMemo(() => (currentTenantId ? listUserCompanyMemberships(currentTenantId) : []), [
    storeState,
    currentTenantId
  ]);
  const userRoleAssignments = useMemo(() => (currentTenantId ? listUserRoleAssignments(currentTenantId) : []), [
    storeState,
    currentTenantId
  ]);
  const jobFunctions = useMemo(() => (currentTenantId ? listJobFunctions(currentTenantId) : []), [
    storeState,
    currentTenantId
  ]);
  const employees = useMemo(() => (currentTenantId ? listEmployees(currentTenantId) : []), [storeState, currentTenantId]);
  const customers = useMemo(
    () => (currentTenantId && currentCompanyId ? listCustomersVisibleToCompany(currentTenantId, currentCompanyId) : []),
    [storeState, currentTenantId, currentCompanyId]
  );
  const customerCompanyAccess = useMemo(
    () => (currentTenantId ? storeState.customerCompanyAccess.filter(a => a.tenantId === currentTenantId) : []),
    [storeState, currentTenantId]
  );
  const suppliers = useMemo(
    () => (currentTenantId && currentCompanyId ? listSuppliersVisibleToCompany(currentTenantId, currentCompanyId) : []),
    [storeState, currentTenantId, currentCompanyId]
  );
  const supplierCompanyAccess = useMemo(
    () => (currentTenantId ? storeState.supplierCompanyAccess.filter(a => a.tenantId === currentTenantId) : []),
    [storeState, currentTenantId]
  );

  const availableTabKeys = useMemo(() => {
    const keys: string[] = [];

    if (canManageTenants) keys.push('tenants');
    if (canManageTenantSettings) keys.push('settings');
    if (currentTenantId && canManageOrganizations) keys.push('organizations');
    if (currentTenantId && canManageGroups) keys.push('groups');
    if (currentTenantId && canManageCompanies) keys.push('companies');
    if (currentTenantId && canManageCustomers) keys.push('customers');
    if (currentTenantId && canManageSuppliers) keys.push('suppliers');
    if (currentTenantId && canManagePayables) keys.push('finance_payable');
    if (currentTenantId && canManageReceivables) keys.push('finance_receivable');
    if (currentTenantId && canManageUsers) keys.push('users');
    if (currentTenantId && canManageUsers && canManageRoles) keys.push('access');
    if (currentTenantId && canManageJobFunctions) keys.push('job_functions');
    if (currentTenantId && canManageEmployees) keys.push('employees');
    if (currentTenantId && canManageRoles) keys.push('roles');
    if (canReadPermissionsCatalog) keys.push('permissions');
    if (currentTenantId && canManageCoa) keys.push('coa');
    if (currentTenantId && canReadAudit) keys.push('audit');

    return keys;
  }, [
    canManageCompanies,
    canManageCoa,
    canManageCustomers,
    canManageEmployees,
    canManageGroups,
    canManageJobFunctions,
    canManageOrganizations,
    canManagePayables,
    canManageReceivables,
    canManageRoles,
    canManageSuppliers,
    canManageTenantSettings,
    canManageTenants,
    canManageUsers,
    canReadAudit,
    canReadPermissionsCatalog,
    currentTenantId,
  ]);

  const activeTabKey =
    requestedTabKey && availableTabKeys.includes(requestedTabKey) ? requestedTabKey : availableTabKeys[0] || null;

  useEffect(() => {
    if (!activeTabKey) return;
    const params = new URLSearchParams(location.search);
    const current = params.get('tab');
    if (current === activeTabKey) return;
    params.set('tab', activeTabKey);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
  }, [activeTabKey, navigate, location.pathname, location.search]);

  return (
    <>
      <div className="registry">
        <PageHeader title="Central de Cadastramento" subTitle="Cadastros e parametrizações do tenant" />
        <Card
          className="registry__card"
          title="Central de Cadastramento"
          extra={
            <Space>
              <Text type="secondary">Tenant:</Text>
              <Select
                style={{ minWidth: 260 }}
                value={currentTenantId || undefined}
                placeholder="Selecione"
                onChange={(value: UUID) => {
                  setCurrentTenantId(value);
                  refresh();
                }}
              >
                {tenants.map(t => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.name}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          }
        >
          {activeTabKey ? (
            <Tabs
              activeKey={activeTabKey}
              onChange={(nextKey: string) => {
                const params = new URLSearchParams(location.search);
                params.set('tab', nextKey);
                navigate({ pathname: location.pathname, search: `?${params.toString()}` });
              }}
            >
            {canManageTenants ? (
              <Tabs.TabPane tab="Tenants" key="tenants">
                <TenantsTab tenants={tenants} onChanged={refresh} />
              </Tabs.TabPane>
            ) : null}

            {canManageTenantSettings ? (
              <Tabs.TabPane tab="Configurações" key="settings">
                <TenantSettingsTab
                  tenant={currentTenant}
                  tenantId={currentTenantId}
                  settings={tenantSettings}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {canManageOrganizations && currentTenantId ? (
              <Tabs.TabPane tab="Organizações" key="organizations">
                <OrganizationsTab tenantId={currentTenantId} organizations={organizations} onChanged={refresh} />
              </Tabs.TabPane>
            ) : null}

            {canManageGroups && currentTenantId ? (
              <Tabs.TabPane tab="Grupos" key="groups">
                <GroupsTab
                  tenantId={currentTenantId}
                  groups={groups}
                  organizations={organizations}
                  canUseOrganizations={canUseOrganizations}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageCompanies ? (
              <Tabs.TabPane tab="Empresas" key="companies">
                <CompaniesTab
                  tenantId={currentTenantId}
                  companies={companies}
                  companyGroups={companyGroups}
                  organizations={organizations}
                  groups={groups}
                  canUseOrganizations={canUseOrganizations}
                  canUseGroups={canUseGroups}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageCustomers ? (
              <Tabs.TabPane tab="Clientes" key="customers">
                <CustomersTab
                  tenantId={currentTenantId}
                  companies={companies}
                  currentCompanyId={currentCompanyId}
                  onCompanySelected={(companyId: UUID) => {
                    setCurrentCompanyId(companyId);
                    refresh();
                  }}
                  customers={customers}
                  access={customerCompanyAccess}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageSuppliers ? (
              <Tabs.TabPane tab="Fornecedores" key="suppliers">
                <SuppliersTab
                  tenantId={currentTenantId}
                  companies={companies}
                  currentCompanyId={currentCompanyId}
                  onCompanySelected={(companyId: UUID) => {
                    setCurrentCompanyId(companyId);
                    refresh();
                  }}
                  suppliers={suppliers}
                  access={supplierCompanyAccess}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManagePayables ? (
              <Tabs.TabPane tab="Contas a Pagar" key="finance_payable">
                <FinanceTitlesTab
                  tenantId={currentTenantId}
                  type="PAYABLE"
                  companies={companies}
                  currentCompanyId={currentCompanyId}
                  customers={customers}
                  suppliers={suppliers}
                  onCompanySelected={(companyId: UUID) => {
                    setCurrentCompanyId(companyId);
                    refresh();
                  }}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageReceivables ? (
              <Tabs.TabPane tab="Contas a Receber" key="finance_receivable">
                <FinanceTitlesTab
                  tenantId={currentTenantId}
                  type="RECEIVABLE"
                  companies={companies}
                  currentCompanyId={currentCompanyId}
                  customers={customers}
                  suppliers={suppliers}
                  onCompanySelected={(companyId: UUID) => {
                    setCurrentCompanyId(companyId);
                    refresh();
                  }}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageUsers ? (
              <Tabs.TabPane tab="Usuários" key="users">
                <UsersTab
                  tenantId={currentTenantId}
                  users={users}
                  currentUserId={storeState.ui.currentUserId}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageUsers && canManageRoles ? (
              <Tabs.TabPane tab="Acessos" key="access">
                <UserAccessTab
                  tenantId={currentTenantId}
                  users={users}
                  companies={companies}
                  organizations={organizations}
                  roles={roles}
                  memberships={memberships}
                  roleAssignments={userRoleAssignments}
                  currentUserId={storeState.ui.currentUserId}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageJobFunctions ? (
              <Tabs.TabPane tab="Cargos" key="job_functions">
                <JobFunctionsTab tenantId={currentTenantId} jobFunctions={jobFunctions} onChanged={refresh} />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageEmployees ? (
              <Tabs.TabPane tab="Funcionários" key="employees">
                <EmployeesTab
                  tenantId={currentTenantId}
                  employees={employees}
                  companies={companies}
                  users={users}
                  jobFunctions={jobFunctions}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageRoles ? (
              <Tabs.TabPane tab="Roles" key="roles">
                <RolesTab
                  tenantId={currentTenantId}
                  roles={roles}
                  permissions={permissions}
                  rolePermissions={rolePermissions}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {canReadPermissionsCatalog ? (
              <Tabs.TabPane tab="Permissões" key="permissions">
                <PermissionsTab permissions={permissions} />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canManageCoa ? (
              <Tabs.TabPane tab="Plano de Contas (COA)" key="coa">
                <CoaTab
                  tenantId={currentTenantId}
                  companies={companies}
                  organizations={organizations}
                  currentCompanyId={currentCompanyId}
                  onCompanySelected={(companyId: UUID) => {
                    setCurrentCompanyId(companyId);
                    refresh();
                  }}
                  onChanged={refresh}
                />
              </Tabs.TabPane>
            ) : null}

            {currentTenantId && canReadAudit ? (
              <Tabs.TabPane tab="Auditoria" key="audit">
                <AuditTab logs={auditLogs} />
              </Tabs.TabPane>
            ) : null}
            </Tabs>
          ) : (
            <div style={{ padding: 16 }}>
              <Text type="secondary">Sem permissões para acessar a Central de Cadastramento neste tenant.</Text>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
