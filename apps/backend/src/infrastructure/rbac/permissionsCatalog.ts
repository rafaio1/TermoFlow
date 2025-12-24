export type PermissionCatalogEntry = {
  key: string;
  description: string;
};

export const permissionCatalog: PermissionCatalogEntry[] = [
  { key: 'tenants.read', description: 'Ler tenants.' },
  { key: 'tenants.write', description: 'Criar/editar tenants.' },
  { key: 'tenantSettings.read', description: 'Ler configuracoes do tenant.' },
  { key: 'tenantSettings.write', description: 'Editar configuracoes do tenant.' },

  { key: 'organizations.read', description: 'Ler organizacoes.' },
  { key: 'organizations.write', description: 'Criar/editar organizacoes.' },

  { key: 'groups.read', description: 'Ler grupos.' },
  { key: 'groups.write', description: 'Criar/editar grupos.' },

  { key: 'companies.read', description: 'Ler empresas.' },
  { key: 'companies.write', description: 'Criar/editar empresas.' },

  { key: 'coaAccounts.read', description: 'Ler plano de contas (COA).' },
  { key: 'coaAccounts.write', description: 'Criar/editar plano de contas (COA).' },

  { key: 'financeTitles.read', description: 'Ler titulos financeiros (AP/AR).' },
  { key: 'financeTitles.write', description: 'Criar/editar titulos financeiros (AP/AR).' },
  { key: 'financeSettlements.read', description: 'Ler pagamentos/recebimentos.' },
  { key: 'financeSettlements.write', description: 'Registrar/editar pagamentos/recebimentos.' },

  { key: 'customers.read', description: 'Ler clientes.' },
  { key: 'customers.write', description: 'Criar/editar clientes.' },
  { key: 'customerCompanyAccess.read', description: 'Ler visibilidade de clientes por empresa.' },
  { key: 'customerCompanyAccess.write', description: 'Gerenciar visibilidade de clientes por empresa.' },

  { key: 'suppliers.read', description: 'Ler fornecedores.' },
  { key: 'suppliers.write', description: 'Criar/editar fornecedores.' },
  { key: 'supplierCompanyAccess.read', description: 'Ler visibilidade de fornecedores por empresa.' },
  { key: 'supplierCompanyAccess.write', description: 'Gerenciar visibilidade de fornecedores por empresa.' },

  { key: 'users.read', description: 'Ler usuarios.' },
  { key: 'users.write', description: 'Criar/editar usuarios.' },

  { key: 'roles.read', description: 'Ler roles.' },
  { key: 'roles.write', description: 'Criar/editar roles.' },

  { key: 'permissions.read', description: 'Listar permissoes.' },
  { key: 'rolePermissions.write', description: 'Vincular/desvincular permissoes em roles.' },
  { key: 'userCompanyMemberships.read', description: 'Ler vinculos usuario-empresa.' },
  { key: 'userCompanyMemberships.write', description: 'Criar/editar vinculos usuario-empresa.' },
  { key: 'userRoleAssignments.read', description: 'Ler atribuicoes de roles para usuarios.' },
  { key: 'userRoleAssignments.write', description: 'Atribuir/remover roles de usuarios.' },
  { key: 'jobFunctions.read', description: 'Ler cargos (job functions).' },
  { key: 'jobFunctions.write', description: 'Criar/editar cargos (job functions).' },
  { key: 'employees.read', description: 'Ler funcionarios.' },
  { key: 'employees.write', description: 'Criar/editar funcionarios.' },
];

