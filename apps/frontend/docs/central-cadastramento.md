# Central de Cadastramento TermoFlow (canônico)

Este documento define o “núcleo canônico” de entidades (banco) e regras de visibilidade para a Central de Cadastramento do TermoFlow.

## 0) Conceitos (para não confundir)

- **Tenant (obrigatório)**: o cliente do seu SaaS (quem paga/usa). Tudo pertence a um `tenant_id`.
- **Empresa (obrigatório)**: unidade operacional/legal onde ocorre o financeiro/contratos. Quase tudo operacional amarra em `company_id`.
- **Organização (opcional)**: camada “holding/rede” acima das empresas. Um tenant pode ter 0..N organizações.
- **Grupo (opcional)**: agrupamento lógico de empresas (ex.: “Grupo SP”, “Varejo”, “Unidades Norte”), normalmente dentro de uma organização.

## 1) Regras globais de modelagem (padrão ouro B2B)

### 1.1 Colunas padrão (tabelas de negócio)

Em TODA tabela operacional/de negócio:

- `id` (UUID, PK)
- `tenant_id` (UUID, NOT NULL)
- `created_at`, `updated_at` (timestamp)
- `deleted_at` (timestamp, se usar soft delete)
- `created_by_user_id`, `updated_by_user_id` (UUID, auditoria)

Observações:

- `tenant_id` nunca vem “do payload” — vem do contexto (token/session).
- Soft delete: queries sempre `deleted_at IS NULL` por padrão.

### 1.2 Índices/Unicidade sempre com `tenant_id`

Qualquer unicidade “de negócio” deve ser por tenant, nunca global.

Exemplos:

- Documento/Tax ID: `UNIQUE (tenant_id, tax_id)`
- Código: `UNIQUE (tenant_id, code)`

## 2) Feature flags (Organização/Grupo opcionais)

Tabela de configuração por tenant:

`tenant_settings`

- `tenant_id` (PK/FK → `tenants.id`)
- `use_organizations` (bool)
- `use_groups` (bool)

Regras:

- Se `use_organizations = false`, `organization_id` não é obrigatório e não aparece na UI/API.
- Se `use_groups = false`, não há telas nem filtros por grupo; relações com grupos podem ser nulas.

## 3) Estrutura corporativa (Tenant, Organização, Grupo, Empresa)

### 3.1 `tenants` (SaaS)

- `id`
- `name`
- `status` (`ACTIVE` | `SUSPENDED`)
- `primary_domain` (opcional)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

### 3.2 `organizations` (opcional)

- `id`
- `tenant_id`
- `code` (string livre, ex: `"12341"`)
- `name`
- `status` (`ACTIVE` | `INACTIVE`)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

Regras:

- `UNIQUE (tenant_id, code)` (se você quiser impedir códigos duplicados na mesma tenant)

### 3.3 `groups` (opcional)

- `id`
- `tenant_id`
- `organization_id` (nullable se você quiser permitir grupo direto no tenant)
- `code` (string livre)
- `name`
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

Modelagem recomendada:

- Grupo pertence a no máximo 1 organização (`organization_id`), mas pode existir sem organização (se o tenant não usa organização).
- Empresas podem estar em **vários grupos**: use M:N (tabela ponte).

### 3.4 `companies` (obrigatório)

- `id`
- `tenant_id`
- `organization_id` (nullable se `use_organizations=false`)
- `code` (string livre, ex: `"1234123561"`)
- `legal_name`
- `trade_name`
- `tax_id` (CNPJ/CPF se quiser empresa pessoa física)
- `status` (`ACTIVE` | `INACTIVE`)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

### 3.5 Relação Empresa ↔ Grupo (M:N)

`company_groups`

- `tenant_id`
- `company_id`
- `group_id`
- PK composta (`company_id`, `group_id`)

## 4) Usuários, roles e permissões (RBAC sério)

Aqui eu separo **função de trabalho (cargo)** de **função de acesso (role)**. Este item cobre o RBAC (roles/permissões); cargos podem existir em uma tabela própria (ex.: `job_titles`) sem impactar o controle de acesso.

### 4.1 `users` (autenticação / identidade)

- `id`
- `tenant_id`
- `email` (único por tenant)
- `name`
- `status` (`ACTIVE` | `INVITED` | `BLOCKED`)
- `password_hash` (se auth local) ou `auth_provider` (se SSO)
- `last_login_at` (opcional)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

Regras:

- `UNIQUE (tenant_id, email)` (recomendado normalizar como `lower(trim(email))` no backend).
- Por segurança, `password_hash` nunca deve sair em listagens comuns.

### 4.2 `roles` (função de acesso)

- `id`
- `tenant_id`
- `name` (ex.: `"Admin"`, `"Financeiro"`, `"Contrato Viewer"`)
- `scope` (`TENANT` | `ORGANIZATION` | `COMPANY`)
- `is_system` (bool)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

Regras:

- `UNIQUE (tenant_id, name)` (recomendado normalizar como `lower(trim(name))`).

### 4.3 Vínculo do usuário com empresas (visibilidade)

`user_company_memberships`

- `tenant_id`
- `user_id`
- `company_id`
- `status` (`ACTIVE` | `INACTIVE`)
- `is_default` (bool) — empresa padrão
- PK (`user_id`, `company_id`)

Regras:

- Somente 1 vínculo `is_default=true` por (`tenant_id`, `user_id`) e ele deve estar `status=ACTIVE`.

`user_role_assignments`

- `tenant_id`
- `user_id`
- `role_id`
- `scope_company_id` (nullable)
- `scope_organization_id` (nullable)

Regra prática:

- Se `role.scope = COMPANY`, então `scope_company_id` é obrigatório.
- Se `role.scope = ORGANIZATION`, então `scope_organization_id` é obrigatório.
- Se `role.scope = TENANT`, ambos `NULL`.

### 4.4 Funções (cargos) e funcionários

`job_functions` (cargo/posição)

- `id`
- `tenant_id`
- `name` (ex.: "Analista Financeiro", "Compras")
- `code` (opcional)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

`employees`

- `id`
- `tenant_id`
- `company_id`
- `user_id` (nullable) — funcionário pode ou não ter login
- `job_function_id` (nullable)
- `name`
- `document` (CPF)
- `email`, `phone`
- `status` (`ACTIVE` | `INACTIVE`)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

### 4.5 `permissions` (catálogo do sistema)

- `id`
- `key` (ex.: `customers.read`, `finance.ap.write`)
- `description`

Regra:

- Pode ser global (sem `tenant_id`) e seedada.

### 4.6 `role_permissions` (N:N role ↔ permission)

- `tenant_id`
- `role_id`
- `permission_id`
- PK (`role_id`, `permission_id`)

Observação:

- `tenant_id` ajuda a isolar/indexar, mesmo com `role_id` amarrando no tenant.

## 5) Clientes e fornecedores (cadastros externos) com visibilidade por empresa

Você pode querer:

- Cliente/fornecedor **compartilhado** entre empresas (mesmo tenant)
- Ou **restrito** a empresas específicas

### 5.1 `customers`

- `id`
- `tenant_id`
- `name`
- `document_type` (`CPF` | `CNPJ` | `OUTRO`)
- `document_number`
- `email`, `phone`
- `status` (`ACTIVE` | `INACTIVE`)
- `is_shared` (bool) — se `true`, visível para todas as empresas do tenant
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

Recomendação:

- `UNIQUE (tenant_id, document_type, document_number)` (opcional, mas recomendado).

### 5.2 `suppliers`

- `id`
- `tenant_id`
- `name`
- `document_type`
- `document_number`
- `email`, `phone`
- `status` (`ACTIVE` | `INACTIVE`)
- `is_shared` (bool)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

### 5.3 Tabelas de vínculo para visibilidade (quando não for shared)

`customer_company_access`

- `tenant_id`
- `customer_id`
- `company_id`
- PK (`customer_id`, `company_id`)

`supplier_company_access`

- `tenant_id`
- `supplier_id`
- `company_id`
- PK (`supplier_id`, `company_id`)

### 5.4 Regra de visibilidade

- Se `is_shared=true`: qualquer empresa do tenant vê.
- Se `is_shared=false`: só vê se existir vínculo em `*_company_access`.

## 6) Financeiro: Contas a Pagar (AP) e Contas a Receber (AR)

A modelagem canônica usa um **título financeiro genérico** com `type` e você expõe na API como endpoints separados (`/accounts-payable` e `/accounts-receivable`) filtrando por `type`.

### 6.1 `finance_titles` (entidade base)

- `id`, `tenant_id`, `company_id` (obrigatório)
- `type` (`PAYABLE` | `RECEIVABLE`)
- `status` (`DRAFT` | `OPEN` | `PARTIALLY_PAID` | `PAID` | `CANCELED` | `OVERDUE`)
- `issue_date`, `due_date`, `competence_date`
- `amount_original`, `amount_open`
- `currency` (ex.: `BRL`)
- `description`, `document_number`, `installment_number`
- `category_coa_account_id` (FK COA)
- `cost_center_id` (opcional futuro)
- `created_from` (`MANUAL` | `IMPORT` | `CONTRACT` | `WHATSAPP` etc.)
- `customer_id` (nullable)
- `supplier_id` (nullable)
- auditoria (`created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `deleted_at`)

Constraints importantes:

- Se `type = PAYABLE` → `supplier_id NOT NULL` e `customer_id NULL`
- Se `type = RECEIVABLE` → `customer_id NOT NULL` e `supplier_id NULL`

### 6.2 `finance_settlements` (pagamentos e recebimentos)

- `id`, `tenant_id`, `company_id`
- `title_id` (FK `finance_titles`)
- `paid_at`
- `amount`
- `method` (`PIX` | `BOLETO` | `TED` | `CASH` | `CARD`)
- `reference` (txid, nosso número etc.)
- `bank_account_id` (opcional futuro)
- auditoria mínima (`created_at`, `created_by_user_id`)

Regras:

- `amount_open = amount_original - SUM(settlements.amount)`
- Status calculado pelo aberto + vencimento:
  - `PAID` quando `amount_open <= 0`
  - `PARTIALLY_PAID` quando `0 < amount_open < amount_original`
  - `OVERDUE` quando `amount_open > 0` e `due_date < hoje`
  - `OPEN` caso contrário

## 7) Regras canônicas de visibilidade (Tenant + Empresa)

### 7.1 Isolamento multi-tenant (obrigatório)

Em toda query de negócio:

- `WHERE tenant_id = :current_tenant_id`

Isso é **inviolável** (não opcional).

### 7.2 Visibilidade por Empresa (pilar operacional)

Recomendação canônica:

- O usuário tem um “escopo de acesso” que resolve para um conjunto de empresas permitidas.
- Toda tabela operacional tem `company_id` e toda query filtra por `company_id IN (:allowed_company_ids)`.

Exemplo de fonte de "allowed_company_ids":

- `user_company_memberships` (acesso direto à empresa)
- `user_role_assignments`:
  - role com `scope=TENANT` → acesso a todas as empresas do tenant
  - role com `scope=ORGANIZATION` → expande para empresas da organização
  - role com `scope=COMPANY` → acesso direto à empresa

Pseudoregra:

1. Se usuário tem role com `scope=TENANT`: vê tudo no tenant.
2. Senão, `allowed_companies = union(companies_from_memberships + companies_from_company_roles + companies_from_org_roles)`.
3. Se `allowed_companies` vazio: não vê nada operacional.

### 7.3 Operacionais sempre com `company_id`

Qualquer entidade operacional (contratos, contas a pagar/receber, lançamentos, COA efetivo, centros de custo etc.) deve conter:

- `tenant_id`
- `company_id`

E obedecer os filtros do item 7.1 e 7.2.

## 8) Regras de visibilidade obrigatórias (backend)

### 8.1 Regra 1 — Tenant é absoluto

- Toda query operacional aplica `WHERE tenant_id = :current_tenant_id` antes de qualquer agregação, join ou mutação.
- O `tenant_id` nunca vem do payload; ele sai do token/credencial.

### 8.2 Regra 2 — Empresa como contexto de operação

- Operações financeiras e contratuais exigem `company_id`.
- Usuários acessam um `company_id` somente se houver `user_company_memberships` ativo no tenant.
- O backend determina os `company_id` permitidos combinando `memberships` + `user_role_assignments` e filtra todas as entidades com esses ids.

### 8.3 Regra 3 — Entidades compartilháveis

- Clientes e fornecedores com `is_shared = true` estão visíveis para todas as empresas no tenant.
- Quando `is_shared = false`, o backend só retorna a entidade para a empresa se existir o vínculo em `*_company_access`.

### 8.4 Regra 4 — Organização/Grupo dependem de feature flags

- Se `tenant_settings.use_organizations = false`, `organization_id` fica nulo nas empresas e filtros/telas de organização devem ser ignorados ou bloqueados.
- Se `tenant_settings.use_groups = false`, toda operação envolvendo `groups` ou `company_groups` precisa ser considerada desabilitada pelo backend.

## 9) Auditoria e Log (quem/quando/o quê)

Além dos campos `created_*`/`updated_*`, recomenda-se log canônico de eventos:

`audit_logs`

- `id`
- `tenant_id`
- `company_id` (nullable; quando aplicável)
- `actor_user_id` (quem)
- `action` (`CREATE` | `UPDATE` | `DELETE` | `RESTORE`)
- `entity_type` (ex.: `tenants`, `companies`, `coa_accounts`)
- `entity_id`
- `before` (JSON)
- `after` (JSON)
- `created_at` (quando)
- metadados (opcional): `ip`, `user_agent`, `request_id`

Regra:

- Toda mutação relevante gera 1 linha em `audit_logs`.

## 10) COA / Plano de Contas (altamente parametrizável)

### 9.1 Chart e contas

- `coa_charts` (o “plano”) permite separar a definição do plano das contas que o compõem:
  - `id`, `tenant_id`
  - `name` (ex: “Plano Padrão 2026”)
  - `scope` (`TENANT` | `ORGANIZATION` | `COMPANY`)
  - `organization_id` (nullable)
  - `company_id` (nullable)
  - `is_default` (bool) — qual chart o sistema deve mostrar automaticamente
  - auditoria

  Uso típico:

  - Um tenant com várias empresas pode ter 1 chart `TENANT` compartilhado ou um chart `COMPANY` por empresa.
  - Charts `ORGANIZATION` podem ser reaproveitados por todas as empresas da organização.

+- `coa_accounts` representam as contas dentro de um chart:
  - `id`, `tenant_id`, `chart_id`
  - `parent_id` (hierarquia)
  - `code` (string livre)
  - `name`
  - `type` (`ASSET` | `LIABILITY` | `EQUITY` | `REVENUE` | `EXPENSE` | `OFF_BALANCE`)
  - `is_postable` (bool) — se pode receber lançamentos
  - `status` (`ACTIVE` | `INACTIVE`)
  - auditoria

  Regras:

  - `code` é armazenado “como veio” mas também normalizado.
  - Unicidade por `(tenant_id, chart_id, code_normalized)`.

### 9.2 Templates e sequências de código

Templates opcionais ajudam a compor códigos a partir de dados como organização/empresa/seqüência:

- `code_templates`
  - `id`, `tenant_id`
  - `target` (ex: `COA_ACCOUNT_CODE`, `COMPANY_CODE`)
  - `name`, `pattern`, `example_output`
  - auditoria

- `code_sequences`
  - `id`, `tenant_id`, `template_id`
  - `scope_company_id` (nullable)
  - `scope_org_id` (nullable)
  - `current_value`
  - auditoria

Patterns suportados (ex.: `{{org.code}}-{{company.code}}-{{static:FIN}}-{{seq:4}}`). A geração:

1. Resolve `{{org.code}}` e `{{company.code}}` no escopo indicado.
2. `{{static:XXX}}` insere texto fixo.
3. `{{seq:N}}` consome/incrementa a sequência (`scope_company_id` > `scope_org_id` > tenant).

Importante: mesmo usando template, armazene o código final na conta para histórico/ auditoria.

- `tenant_id`, `company_id` (PK composto)
- `code_mode` (`MANUAL` | `GENERATED`)
- `code_pattern` (opcional; ex.: `{{parent}}.{{seq:03}}`)
- `code_separator` (opcional)
- `allow_free_text` (bool) — se `true`, aceita strings fora do padrão mesmo em `GENERATED` (com validação/alerta)
- auditoria

### 9.3 Regra de geração de códigos (recomendação)

Mesmo que a UI “mostre” um preview, o **backend** deve ser a fonte da verdade para gerar e validar códigos (concorrência).

Abordagem segura:

- Backend guarda um contador por (tenant_id, company_id, parent_account_id) e gera o próximo código.

## 11) DDL de referência (PostgreSQL, exemplo)

> Ajuste nomes/tipos conforme o stack. O importante é: `tenant_id` em tudo, unicidades com `tenant_id` e auditoria consistente.

```sql
-- Extensions
-- create extension if not exists "uuid-ossp";

create table tenants (
  id uuid primary key,
  name text not null,
  status text not null check (status in ('ACTIVE','SUSPENDED')),
  primary_domain text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null
);

create table tenant_settings (
  tenant_id uuid primary key references tenants(id),
  use_organizations boolean not null default false,
  use_groups boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid null,
  updated_by_user_id uuid null
);

create table users (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  email text not null,
  name text not null,
  status text not null check (status in ('ACTIVE','INVITED','BLOCKED')),
  password_hash text null,
  auth_provider text null,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, email)
);

create index users_tenant_id_idx on users(tenant_id);

create table roles (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  scope text not null check (scope in ('TENANT','ORGANIZATION','COMPANY')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, name)
);

create index roles_tenant_id_idx on roles(tenant_id);

-- Catálogo global seedado (sem tenant_id)
create table permissions (
  id uuid primary key,
  key text not null unique,
  description text not null
);

create table role_permissions (
  tenant_id uuid not null references tenants(id),
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  created_at timestamptz not null default now(),
  created_by_user_id uuid null,
  primary key (role_id, permission_id)
);

create index role_permissions_tenant_role_id_idx on role_permissions(tenant_id, role_id);

create table organizations (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  code text null,
  name text not null,
  status text not null check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null
);

create index organizations_tenant_id_idx on organizations(tenant_id);

create table groups (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  organization_id uuid null references organizations(id),
  code text null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null
);

create index groups_tenant_id_idx on groups(tenant_id);
create index groups_tenant_org_id_idx on groups(tenant_id, organization_id);

create table companies (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  organization_id uuid null references organizations(id),
  code text null,
  legal_name text null,
  trade_name text not null,
  tax_id text null,
  status text not null check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, code),
  unique (tenant_id, tax_id)
);

create index companies_tenant_id_idx on companies(tenant_id);
create index companies_tenant_org_id_idx on companies(tenant_id, organization_id);

create table company_groups (
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  group_id uuid not null references groups(id),
  created_at timestamptz not null default now(),
  created_by_user_id uuid null,
  primary key (company_id, group_id)
);

create table user_company_memberships (
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id),
  company_id uuid not null references companies(id),
  status text not null check (status in ('ACTIVE','INACTIVE')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  primary key (user_id, company_id)
);

create index user_company_memberships_tenant_user_id_idx on user_company_memberships(tenant_id, user_id);
create index user_company_memberships_tenant_company_id_idx on user_company_memberships(tenant_id, company_id);

create unique index user_company_memberships_one_default_idx
  on user_company_memberships(tenant_id, user_id)
  where is_default = true and status = 'ACTIVE';

create table user_role_assignments (
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id),
  role_id uuid not null references roles(id),
  scope_company_id uuid null references companies(id),
  scope_organization_id uuid null references organizations(id),
  created_at timestamptz not null default now(),
  created_by_user_id uuid null,
  check (
    (scope_company_id is null and scope_organization_id is null)
    or (scope_company_id is not null and scope_organization_id is null)
    or (scope_company_id is null and scope_organization_id is not null)
  )
);

create index user_role_assignments_tenant_user_id_idx on user_role_assignments(tenant_id, user_id);
create index user_role_assignments_tenant_role_id_idx on user_role_assignments(tenant_id, role_id);

create unique index user_role_assignments_tenant_scope_idx
  on user_role_assignments(tenant_id, user_id, role_id)
  where scope_company_id is null and scope_organization_id is null;

create unique index user_role_assignments_company_scope_idx
  on user_role_assignments(tenant_id, user_id, role_id, scope_company_id)
  where scope_company_id is not null and scope_organization_id is null;

create unique index user_role_assignments_org_scope_idx
  on user_role_assignments(tenant_id, user_id, role_id, scope_organization_id)
  where scope_organization_id is not null and scope_company_id is null;

create table job_functions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, code)
);

create index job_functions_tenant_id_idx on job_functions(tenant_id);

create table employees (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  user_id uuid null references users(id),
  job_function_id uuid null references job_functions(id),
  name text not null,
  document text not null,
  email text null,
  phone text null,
  status text not null check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, document)
);

create index employees_tenant_id_idx on employees(tenant_id);
create index employees_tenant_company_id_idx on employees(tenant_id, company_id);

create table customers (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  document_type text not null check (document_type in ('CPF','CNPJ','OUTRO')),
  document_number text not null,
  email text null,
  phone text null,
  status text not null check (status in ('ACTIVE','INACTIVE')),
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, document_type, document_number)
);

create index customers_tenant_id_idx on customers(tenant_id);

create table customer_company_access (
  tenant_id uuid not null references tenants(id),
  customer_id uuid not null references customers(id),
  company_id uuid not null references companies(id),
  created_at timestamptz not null default now(),
  created_by_user_id uuid null,
  primary key (customer_id, company_id)
);

create index customer_company_access_tenant_company_id_idx on customer_company_access(tenant_id, company_id);

create table suppliers (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  document_type text not null check (document_type in ('CPF','CNPJ','OUTRO')),
  document_number text not null,
  email text null,
  phone text null,
  status text not null check (status in ('ACTIVE','INACTIVE')),
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, document_type, document_number)
);

create index suppliers_tenant_id_idx on suppliers(tenant_id);

create table supplier_company_access (
  tenant_id uuid not null references tenants(id),
  supplier_id uuid not null references suppliers(id),
  company_id uuid not null references companies(id),
  created_at timestamptz not null default now(),
  created_by_user_id uuid null,
  primary key (supplier_id, company_id)
);

create index supplier_company_access_tenant_company_id_idx on supplier_company_access(tenant_id, company_id);

create table coa_charts (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  name text not null,
  scope text not null check (scope in ('TENANT','ORGANIZATION','COMPANY')),
  organization_id uuid null references organizations(id),
  company_id uuid null references companies(id),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null
);

create index coa_charts_tenant_idx on coa_charts(tenant_id);

create table coa_accounts (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  chart_id uuid not null references coa_charts(id),
  parent_account_id uuid null references coa_accounts(id),
  code text not null,
  code_normalized text not null,
  name text not null,
  type text not null check (type in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE','OFF_BALANCE')),
  is_postable boolean not null default true,
  status text not null check (status in ('ACTIVE','INACTIVE')),
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  unique (tenant_id, chart_id, code_normalized)
);

create index coa_accounts_chart_idx on coa_accounts(tenant_id, chart_id);
create index coa_accounts_parent_idx on coa_accounts(chart_id, parent_account_id);

create table code_templates (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  target text not null,
  name text not null,
  pattern text not null,
  example_output text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null
);

create table code_sequences (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  template_id uuid not null references code_templates(id),
  scope_company_id uuid null references companies(id),
  scope_org_id uuid null references organizations(id),
  current_value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid null,
  updated_by_user_id uuid null
);

create index code_sequences_template_idx on code_sequences(template_id, tenant_id);

create table finance_titles (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  type text not null check (type in ('PAYABLE','RECEIVABLE')),
  status text not null check (status in ('DRAFT','OPEN','PARTIALLY_PAID','PAID','CANCELED','OVERDUE')),
  issue_date timestamptz null,
  due_date timestamptz null,
  competence_date timestamptz null,
  amount_original numeric(18,2) not null,
  amount_open numeric(18,2) not null,
  currency text not null default 'BRL',
  description text null,
  document_number text null,
  installment_number text null,
  category_coa_account_id uuid null references coa_accounts(id),
  cost_center_id uuid null,
  created_from text not null default 'MANUAL',
  customer_id uuid null references customers(id),
  supplier_id uuid null references suppliers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  created_by_user_id uuid null,
  updated_by_user_id uuid null,
  check (
    (type = 'PAYABLE' and supplier_id is not null and customer_id is null)
    or
    (type = 'RECEIVABLE' and customer_id is not null and supplier_id is null)
  )
);

create index finance_titles_tenant_company_idx on finance_titles(tenant_id, company_id);
create index finance_titles_tenant_company_type_idx on finance_titles(tenant_id, company_id, type);

create table finance_settlements (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id),
  title_id uuid not null references finance_titles(id),
  paid_at timestamptz not null,
  amount numeric(18,2) not null,
  method text not null check (method in ('PIX','BOLETO','TED','CASH','CARD')),
  reference text null,
  bank_account_id uuid null,
  created_at timestamptz not null default now(),
  created_by_user_id uuid null
);

create index finance_settlements_tenant_title_idx on finance_settlements(tenant_id, title_id);
create index finance_settlements_tenant_company_idx on finance_settlements(tenant_id, company_id);

create table audit_logs (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  company_id uuid null references companies(id),
  actor_user_id uuid null,
  action text not null check (action in ('CREATE','UPDATE','DELETE','RESTORE')),
  entity_type text not null,
  entity_id uuid not null,
  before jsonb null,
  after jsonb null,
  created_at timestamptz not null default now()
);

create index audit_logs_tenant_idx on audit_logs(tenant_id, created_at desc);
```
