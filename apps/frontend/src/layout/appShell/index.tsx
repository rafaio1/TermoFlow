import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AutoComplete, Avatar, Breadcrumb, Dropdown, Input, Layout, Menu, Typography } from 'antd';
import {
  UserOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LogoIcon from '@icons/LogoIcon';
import MaterialIcon from '@icons/MaterialIcon';
import { loadRegistryStore, setCurrentTenantId } from '../../controllers/registry';
import { getPermissionKeysForUser, isCurrentUserAdmin } from '@utils/access';
import { applyBrandingToDom, loadBrandingForTenant } from '@utils/branding';

import './styles.less';
import { useTranslation } from 'react-i18next';
import { UUID } from '../../controllers/registry/types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type Props = {
  children: React.ReactNode;
};

type NavItem = {
  key: string;
  route: string;
  title: string;
  subtitle?: string;
  keywords: string;
  iconName: string;
  disabled?: boolean;
};

const REGISTRY_TAB_LABELS: Record<string, string> = {
  tenants: 'Tenants',
  settings: 'Configurações',
  organizations: 'Organizações',
  groups: 'Grupos',
  companies: 'Empresas',
  customers: 'Clientes',
  suppliers: 'Fornecedores',
  finance_payable: 'Contas a Pagar',
  finance_receivable: 'Contas a Receber',
  users: 'Usuários',
  access: 'Acessos',
  job_functions: 'Cargos',
  employees: 'Funcionários',
  roles: 'Roles',
  permissions: 'Permissões',
  coa: 'Plano de Contas (COA)',
  audit: 'Auditoria',
};

const REGISTRY_TAB_ICON: Record<string, string> = {
  tenants: 'domain',
  settings: 'tune',
  organizations: 'account_tree',
  groups: 'groups',
  companies: 'apartment',
  customers: 'handshake',
  suppliers: 'local_shipping',
  finance_payable: 'payments',
  finance_receivable: 'request_quote',
  users: 'person',
  access: 'admin_panel_settings',
  job_functions: 'badge',
  employees: 'group',
  roles: 'security',
  permissions: 'key',
  coa: 'account_tree',
  audit: 'history',
};

type RegistryMenuGroup = 'finance' | 'administrative' | 'administrator';

function getRegistryGroupForTab(tab: string): RegistryMenuGroup {
  if (tab === 'finance_payable' || tab === 'finance_receivable' || tab === 'coa') return 'finance';
  if (
    tab === 'companies' ||
    tab === 'customers' ||
    tab === 'suppliers' ||
    tab === 'organizations' ||
    tab === 'groups' ||
    tab === 'job_functions' ||
    tab === 'employees'
  ) {
    return 'administrative';
  }
  return 'administrator';
}

function getRegistryTab(search: string): string {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab && Object.prototype.hasOwnProperty.call(REGISTRY_TAB_LABELS, tab)) return tab;
  return 'tenants';
}

function getSelectedKey(pathname: string, search: string): string {
  if (pathname.startsWith('/admin/branding')) return 'admin_branding';
  if (pathname.startsWith('/cadastros')) return `registry_${getRegistryTab(search)}`;
  return 'home';
}

function getBreadcrumbItems(pathname: string, search: string): { key: string; label: React.ReactNode }[] {
  if (pathname.startsWith('/admin/branding')) {
    return [
      { key: 'settings', label: 'Configurações' },
      { key: 'branding', label: 'Identidade visual' }
    ];
  }
  if (pathname.startsWith('/cadastros')) {
    const tab = getRegistryTab(search);
    return [
      { key: 'registry', label: 'Central de Cadastramento' },
      { key: tab, label: REGISTRY_TAB_LABELS[tab] }
    ];
  }
  return [{ key: 'home', label: 'Visão geral' }];
}

function readSiderCollapsed(): boolean {
  try {
    return window.localStorage.getItem('termoflow.ui.siderCollapsed') === 'true';
  } catch (_err) {
    return false;
  }
}

function writeSiderCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem('termoflow.ui.siderCollapsed', String(value));
  } catch (_err) {
    // ignore
  }
}

function AppShell({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = getSelectedKey(location.pathname, location.search);
  const breadcrumbItems = useMemo(
    () => getBreadcrumbItems(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const [collapsed, setCollapsed] = useState(readSiderCollapsed);
  const [isBroken, setIsBroken] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef<any>(null);
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    if (location.pathname.startsWith('/cadastros')) return ['registry'];
    return [];
  });
  const toggleCollapsed = () => {
    setCollapsed(current => {
      const next = !current;
      writeSiderCollapsed(next);
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const [contextVersion, setContextVersion] = useState(0);
  const [brandingVersion, setBrandingVersion] = useState(0);

  useEffect(() => {
    const onContextUpdated = () => setContextVersion(v => v + 1);
    const onBrandingUpdated = () => setBrandingVersion(v => v + 1);
    window.addEventListener('termoflow:context-updated', onContextUpdated as any);
    window.addEventListener('termoflow:branding-updated', onBrandingUpdated as any);
    return () => {
      window.removeEventListener('termoflow:context-updated', onContextUpdated as any);
      window.removeEventListener('termoflow:branding-updated', onBrandingUpdated as any);
    };
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith('/cadastros')) return;
    const tab = getRegistryTab(location.search);
    const group = getRegistryGroupForTab(tab);
    const groupKey = group === 'finance' ? 'registry_finance' : group === 'administrative' ? 'registry_administrative' : 'registry_administrator';
    setOpenKeys(current => {
      const next = new Set(current);
      next.add('registry');
      next.add(groupKey);
      return Array.from(next);
    });
  }, [location.pathname, location.search]);

  const store = useMemo(() => loadRegistryStore(), [contextVersion]);
  const user = store.users.find(u => u.id === store.ui.currentUserId && u.deletedAt === null) || null;
  const tenant = store.tenants.find(t => t.id === store.ui.currentTenantId && t.deletedAt === null) || null;

  const tenantId = store.ui.currentTenantId || (store.tenants.find(t => t.deletedAt === null)?.id ?? null);
  const userId = store.ui.currentUserId;
  const permissionKeys = useMemo(() => {
    if (!tenantId || !userId) return new Set<string>();
    return getPermissionKeysForUser(store, tenantId, userId);
  }, [store, tenantId, userId]);
  const hasAnyPermission = (keys: string[]) => keys.some(key => permissionKeys.has(key));

  const canManageTenants = hasAnyPermission(['registry.tenants.read', 'registry.tenants.write']);
  const canManageTenantSettings = hasAnyPermission(['registry.tenants.write']);
  const canManageOrganizations = hasAnyPermission(['registry.organizations.read', 'registry.organizations.write']);
  const canManageGroups = hasAnyPermission(['registry.groups.read', 'registry.groups.write']);
  const canManageCompanies = hasAnyPermission(['registry.companies.read', 'registry.companies.write']);
  const canManageCustomers = hasAnyPermission(['customers.read', 'customers.write']);
  const canManageSuppliers = hasAnyPermission(['suppliers.read', 'suppliers.write']);
  const canManageJobFunctions = hasAnyPermission(['registry.job_functions.read', 'registry.job_functions.write']);
  const canManageEmployees = hasAnyPermission(['registry.employees.read', 'registry.employees.write']);
  const canManagePayables = hasAnyPermission(['finance.ap.read', 'finance.ap.write']);
  const canManageReceivables = hasAnyPermission(['finance.ar.read', 'finance.ar.write']);
  const canManageCoa = hasAnyPermission(['registry.coa.read', 'registry.coa.write']);
  const canReadAudit = hasAnyPermission(['registry.audit.read']);
  const canManageUsers = hasAnyPermission(['rbac.users.read', 'rbac.users.write']);
  const canManageRoles = hasAnyPermission(['rbac.roles.read', 'rbac.roles.write']);
  const canReadPermissionsCatalog = hasAnyPermission(['rbac.permissions.read']);

  const canUseFinanceProfile = canManagePayables || canManageReceivables || canManageCoa;
  const canUseAdministrativeProfile =
    canManageCompanies ||
    canManageCustomers ||
    canManageSuppliers ||
    canManageOrganizations ||
    canManageGroups ||
    canManageJobFunctions ||
    canManageEmployees;
  const canUseAdministratorProfile =
    canManageTenants || canManageTenantSettings || canManageUsers || canManageRoles || canReadPermissionsCatalog || canReadAudit;

  const canSeeRegistryMenu = canUseFinanceProfile || canUseAdministrativeProfile || canUseAdministratorProfile;
  const canAdminByRole = isCurrentUserAdmin();
  const canAdmin = canAdminByRole || canManageTenantSettings;

  const canAccessRegistryTab = useCallback((tabKey: string): boolean => {
    if (tabKey === 'tenants') return canManageTenants;
    if (tabKey === 'settings') return canManageTenantSettings;
    if (tabKey === 'organizations') return canManageOrganizations;
    if (tabKey === 'groups') return canManageGroups;
    if (tabKey === 'companies') return canManageCompanies;
    if (tabKey === 'customers') return canManageCustomers;
    if (tabKey === 'suppliers') return canManageSuppliers;
    if (tabKey === 'finance_payable') return canManagePayables;
    if (tabKey === 'finance_receivable') return canManageReceivables;
    if (tabKey === 'users') return canManageUsers;
    if (tabKey === 'access') return canManageUsers && canManageRoles;
    if (tabKey === 'job_functions') return canManageJobFunctions;
    if (tabKey === 'employees') return canManageEmployees;
    if (tabKey === 'roles') return canManageRoles;
    if (tabKey === 'permissions') return canReadPermissionsCatalog;
    if (tabKey === 'coa') return canManageCoa;
    if (tabKey === 'audit') return canReadAudit;
    return false;
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
  ]);

  const tenantSettings = tenantId ? store.tenantSettings.find(s => s.tenantId === tenantId) || null : null;
  const canUseOrganizations = !!(tenantSettings && tenantSettings.useOrganizations);
  const canUseGroups = !!(tenantSettings && tenantSettings.useGroups);
  const hasTenantContext = !!tenantId;
  const branding = useMemo(() => loadBrandingForTenant(tenantId), [tenantId, brandingVersion]);

  useEffect(() => {
    applyBrandingToDom(branding);
  }, [branding]);

  const registryNavItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [];

    Object.keys(REGISTRY_TAB_LABELS).forEach(tabKey => {
      if (!canAccessRegistryTab(tabKey)) return;
      if (tabKey === 'organizations' && !canUseOrganizations) return;
      if (tabKey === 'groups' && !canUseGroups) return;

      const label = REGISTRY_TAB_LABELS[tabKey];
      const route = `/cadastros?tab=${tabKey}`;
      const needsTenant =
        tabKey !== 'tenants' &&
        tabKey !== 'settings' &&
        tabKey !== 'permissions';

      items.push({
        key: `registry_${tabKey}`,
        route,
        title: label,
        subtitle: 'Central de Cadastramento',
        keywords: `cadastros central cadastramento registry ${tabKey} ${label}`.toLowerCase(),
        iconName: REGISTRY_TAB_ICON[tabKey] || 'grid_view',
        disabled: needsTenant && !hasTenantContext,
      });
    });

    return items;
  }, [canAccessRegistryTab, canUseGroups, canUseOrganizations, hasTenantContext]);

  const navItems = useMemo((): NavItem[] => {
    const base: NavItem[] = [
      {
        key: 'home',
        route: '/',
        title: 'Visão geral',
        subtitle: 'Página inicial',
        keywords: 'home visão geral inicio dashboard',
        iconName: 'home',
      },
      ...(canSeeRegistryMenu
        ? ([
            {
              key: 'registry',
              route: '/cadastros',
              title: 'Cadastros',
              subtitle: 'Central de Cadastramento',
              keywords: 'cadastros central cadastramento registry',
              iconName: 'grid_view',
            },
            ...registryNavItems,
          ] as NavItem[])
        : ([] as NavItem[])),
    ];

    if (canAdmin) {
      base.push({
        key: 'admin_branding',
        route: '/admin/branding',
        title: 'Identidade visual',
        subtitle: 'Admin',
        keywords: 'admin identidade visual branding logo cores tema',
        iconName: 'palette',
      });
    }

    return base;
  }, [canAdmin, registryNavItems]);

  const searchOptions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const matches = query
      ? navItems.filter(item => item.keywords.includes(query) || item.title.toLowerCase().includes(query))
      : navItems;

    return matches.slice(0, 12).map(item => ({
      value: item.route,
      disabled: item.disabled,
      label: (
        <div className="tf-shell__searchOption">
          <span className="tf-shell__searchOptionIcon" aria-hidden="true">
            <MaterialIcon name={item.iconName} />
          </span>
          <span className="tf-shell__searchOptionText">
            <span className="tf-shell__searchOptionTitle">{item.title}</span>
            {item.subtitle ? <span className="tf-shell__searchOptionSubtitle">{item.subtitle}</span> : null}
          </span>
        </div>
      ),
    }));
  }, [navItems, searchValue]);

  const navigateTo = (route: string) => {
    navigate(route);
    setSearchValue('');
    if (isBroken) setCollapsed(true);
  };

  const userMenu = (
    <Menu>
      <Menu.Item label={
        <Text ellipsis style={{ maxWidth: 240, display: 'inline-block' }}>
          {user ? user.email : 'Usuário'}
        </Text>
      } disabled={true} key="user_email" />
      {tenant ? <Menu.Item key="tenant_name" disabled label={`Tenant: ${tenant.name}`} /> : null}
      <Menu.Divider />
      <Menu.Item key="settings" disabled icon={<MaterialIcon name="settings" />} label="Preferências (em breve)" />
    </Menu>
  );

  const appsLauncher = (
    <div className="tf-shell__appsLauncher" role="menu" aria-label="Atalhos">
      <button className="tf-shell__appTile" type="button" role="menuitem" onClick={() => navigateTo('/')}>
        <span className="tf-shell__appTileIcon" aria-hidden="true">
          <MaterialIcon name="home" />
        </span>
        <span className="tf-shell__appTileTitle">Visão geral</span>
      </button>

      {canSeeRegistryMenu ? (
        <button className="tf-shell__appTile" type="button" role="menuitem" onClick={() => navigateTo('/cadastros')}>
          <span className="tf-shell__appTileIcon" aria-hidden="true">
            <MaterialIcon name="grid_view" />
          </span>
          <span className="tf-shell__appTileTitle">Cadastros</span>
        </button>
      ) : null}

      <button
        className="tf-shell__appTile"
        type="button"
        role="menuitem"
        onClick={() => navigateTo('/cadastros?tab=companies')}
        disabled={Boolean(!hasTenantContext || !canManageCompanies)}
      >
        <span className="tf-shell__appTileIcon" aria-hidden="true">
          <MaterialIcon name="apartment" />
        </span>
        <span className="tf-shell__appTileTitle">Empresas</span>
      </button>

      <button
        className="tf-shell__appTile"
        type="button"
        role="menuitem"
        onClick={() => navigateTo('/cadastros?tab=users')}
        disabled={Boolean(!hasTenantContext || !canManageUsers)}
      >
        <span className="tf-shell__appTileIcon" aria-hidden="true">
          <MaterialIcon name="person" />
        </span>
        <span className="tf-shell__appTileTitle">Usuários</span>
      </button>

      <button
        className="tf-shell__appTile"
        type="button"
        role="menuitem"
        onClick={() => navigateTo('/cadastros?tab=coa')}
        disabled={!hasTenantContext || !canManageCoa}
      >
        <span className="tf-shell__appTileIcon" aria-hidden="true">
          <MaterialIcon name="account_tree" />
        </span>
        <span className="tf-shell__appTileTitle">Plano de contas</span>
      </button>

      {canAdmin ? (
        <button className="tf-shell__appTile" type="button" role="menuitem" onClick={() => navigateTo('/admin/branding')}>
          <span className="tf-shell__appTileIcon" aria-hidden="true">
            <MaterialIcon name="palette" />
          </span>
          <span className="tf-shell__appTileTitle">Branding</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <Layout className="tf-app tf-shell">
      <a className="tf-shell__skipLink" href="#main-content">
        Pular para o conteúdo
      </a>

      <Sider
        className="tf-shell__sider"
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={256}
        collapsedWidth={isBroken ? 0 : 72}
        breakpoint="lg"
        onBreakpoint={broken => {
          setIsBroken(broken);
          if (broken) setCollapsed(true);
        }}
      >
        <div className="tf-shell__brand" aria-label={branding.appName}>
          {branding.logoDataUrl ? (
            <img className="tf-shell__logo" src={branding.logoDataUrl} alt={`${branding.appName} logo`} />
          ) : (
            <div className="tf-shell__logoFallback" aria-hidden="true">
              <LogoIcon fill="var(--tf-sider-active-text)" />
            </div>
          )}
          {!collapsed ? <div className="tf-shell__brandName">{branding.appName}</div> : null}
        </div>

        <Menu
          className="tf-shell__menu"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={keys => setOpenKeys(keys as string[])}
        >
          <Menu.Item key="home" icon={<MaterialIcon name="home" />} label={<Link to="/">Visão geral</Link>} />
          {canSeeRegistryMenu ? (
            <Menu.SubMenu key="registry" icon={<MaterialIcon name="grid_view" />} label="Cadastros">
              {canUseFinanceProfile ? (
                <Menu.SubMenu key="registry_finance" label="Financeiro">
                  {canManagePayables ? (
                    <Menu.Item key="registry_finance_payable" disabled={Boolean(!hasTenantContext)} label={<Link to="/cadastros?tab=finance_payable">Contas a Pagar</Link>} />
                  ) : null}
                  {canManageReceivables ? (
                    <Menu.Item key="registry_finance_receivable" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=finance_receivable">Contas a Receber</Link>} />
                  ) : null}
                  {canManageCoa ? (
                    <Menu.Item key="registry_coa" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=coa">Plano de Contas (COA)</Link>} />
                  ) : null}
                </Menu.SubMenu>
              ) : null}

              {canUseAdministrativeProfile ? (
                <Menu.SubMenu key="registry_administrative" label="Administrativo">
                  {canManageOrganizations && canUseOrganizations ? (
                    <Menu.Item key="registry_organizations" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=organizations">Organizações</Link>} />
                  ) : null}
                  {canManageGroups && canUseGroups ? (
                    <Menu.Item key="registry_groups" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=groups">Grupos</Link>} />
                  ) : null}
                  {canManageCompanies ? (
                    <Menu.Item key="registry_companies" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=companies">Empresas</Link>} />
                  ) : null}
                  {canManageCustomers ? (
                    <Menu.Item key="registry_customers" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=customers">Clientes</Link>} />
                  ) : null}
                  {canManageSuppliers ? (
                    <Menu.Item key="registry_suppliers" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=suppliers">Fornecedores</Link>} />
                  ) : null}
                  {canManageJobFunctions ? (
                    <Menu.Item key="registry_job_functions" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=job_functions">Cargos</Link>} />
                  ) : null}
                  {canManageEmployees ? (
                    <Menu.Item key="registry_employees" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=employees">Funcionários</Link>} />
                  ) : null}
                </Menu.SubMenu>
              ) : null}

              {canUseAdministratorProfile ? (
                <Menu.SubMenu key="registry_administrator" label="Administrador">
                  {canManageTenants ? (
                    <Menu.Item key="registry_tenants" label={<Link to="/cadastros?tab=tenants">Tenants</Link>} />
                  ) : null}
                  {canManageTenantSettings ? (
                    <Menu.Item key="registry_settings" label={<Link to="/cadastros?tab=settings">Configurações</Link>} />
                  ) : null}
                  {canManageUsers ? (
                    <Menu.Item key="registry_users" disabled={Boolean(!hasTenantContext)} label={<Link to="/cadastros?tab=users">Usuários</Link>} />
                  ) : null}
                  {canManageUsers && canManageRoles ? (
                    <Menu.Item key="registry_access" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=access">Acessos</Link>} />
                  ) : null}
                  {canManageRoles ? (
                    <Menu.Item key="registry_roles" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=roles">Roles</Link>} />
                  ) : null}
                  {canReadPermissionsCatalog ? (
                    <Menu.Item key="registry_permissions" label={<Link to="/cadastros?tab=permissions">Permissões</Link>} />
                  ) : null}
                  {canReadAudit ? (
                    <Menu.Item key="registry_audit" disabled={!hasTenantContext} label={<Link to="/cadastros?tab=audit">Auditoria</Link>} />
                  ) : null}
                </Menu.SubMenu>
              ) : null}
            </Menu.SubMenu>
          ) : null}
          {canAdmin ? (
            <Menu.Item key="admin_branding" icon={<MaterialIcon name="palette" />} label={<Link to="/admin/branding">Identidade visual</Link>} />
          ) : null}
        </Menu>
      </Sider>

      <Layout>
        <Header className="tf-shell__header">
          <div className="tf-shell__headerLeft">
            <button
              className="tf-shell__collapseButton"
              type="button"
              onClick={toggleCollapsed}
              aria-label="Alternar menu"
              aria-expanded={!collapsed}
            >
              {collapsed ? <MaterialIcon name="menu" /> : <MaterialIcon name="menu_open" />}
            </button>
            <Breadcrumb className="tf-shell__breadcrumb">
              {breadcrumbItems.map(item => (
                <Breadcrumb.Item key={item.key}>{item.label}</Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </div>

          <div className="tf-shell__headerCenter">
            <AutoComplete
              className="tf-shell__search"
              value={searchValue}
              options={searchOptions as any}
              onSelect={value => navigateTo(String(value))}
              onChange={value => setSearchValue(String(value))}
              dropdownMatchSelectWidth={false}
              dropdownClassName="tf-shell__searchDropdown"
            >
              <Input
                ref={searchInputRef}
                allowClear
                placeholder="Pesquisar (Ctrl+K)"
                prefix={<MaterialIcon name="search" size={18} />}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return;
                  const query = searchValue.trim().toLowerCase();
                  if (!query) return;
                  const match = navItems.find(item => !item.disabled && item.keywords.includes(query));
                  if (match) navigateTo(match.route);
                }}
              />
            </AutoComplete>
          </div>

          <div className="tf-shell__headerRight">
            <Dropdown overlay={() => appsLauncher} trigger={['click']} placement="bottomRight">
              <button className="tf-shell__iconButton" type="button" aria-label="Atalhos">
                <MaterialIcon name="apps" />
              </button>
            </Dropdown>

            <Dropdown overlay={() => userMenu} trigger={['click']}>
              <button className="tf-shell__userButton" type="button" aria-label="Menu do usuário">
                <Avatar size="small" icon={<UserOutlined />} />
                <span className="tf-shell__userName">{user ? user.name : 'Usuário'}</span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content className="tf-shell__content">
          <div id="main-content" className="tf-shell__contentInner" role="main" tabIndex={-1}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppShell;
