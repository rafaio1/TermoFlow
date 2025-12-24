# TermoFlow

TermoFlow roda como uma stack completa: **Frontend (SPA)** → **Middleware (GraphQL gateway)** → **Backend (API REST)**, com **PostgreSQL** e **MongoDB** como datastores.

| Módulo | Porta (Docker) | O que faz | Docs |
| --- | --- | --- | --- |
| `apps/frontend` | `3000` | SPA React (CRA) + Ant Design servida via Nginx. Faz proxy de `/api/*` para o middleware (evita CORS). | `apps/frontend/README.md` |
| `apps/middleware` | `4000` | Gateway GraphQL com hardening (rate limit, API key opcional, limites de query). Resolve `upstreamGet` para chamadas **GET** ao backend (com allowlist de paths). | `apps/middleware/README.md` |
| `apps/backend` | `3001` | API REST (Express + Prisma) com regras multi-tenant (via headers) e auditoria (Mongo). | `apps/backend/README.md` |

## Como funciona (fluxo entre módulos)

1. O navegador acessa a SPA em `http://localhost:3000`.
2. A SPA faz `POST` de GraphQL para `http://localhost:3000/api/graphql` (por padrão).
3. O Nginx do frontend faz proxy de `/api/*` para o middleware (`http://middleware:4000/*`), então `/api/graphql` vira `/graphql`.
4. O middleware valida a requisição (tamanho, limites, rate limit, API key opcional) e resolve a query.
5. A query `upstreamGet(path: "/items")` (por exemplo) vira um `GET` no backend (`UPSTREAM_BASE_URL + path`), **somente** se o `path` estiver dentro de `UPSTREAM_ALLOWED_PATH_PREFIXES`.
6. O middleware repassa headers de contexto (ex.: `x-tenant-id`, `x-user-id`, `x-company-id`) para o backend.
7. O backend exige `x-tenant-id` e `x-user-id` (UUID) e usa:
   - **Postgres (Prisma)** para dados (ex.: `items`, `organizations`).
   - **MongoDB** para auditoria (ex.: `POST /items` grava audit log).

## Subindo tudo com Docker (recomendado)

Pré-requisitos: Docker + Docker Compose.

1. `cd TermoFlow`
2. Suba a stack:
   ```bash
   docker compose up --build
   ```
3. Primeira execução: aplique as migrations do Postgres (backend):
   ```bash
   docker compose run --rm backend npx --yes prisma@5.22.0 migrate deploy
   ```
4. URLs:
   - Frontend: `http://localhost:3000/` (GraphQL via `http://localhost:3000/api/graphql`)
   - Middleware GraphQL: `http://localhost:4000/graphql`
   - Backend API: `http://localhost:3001`
   - Postgres: `localhost:5432`, Mongo: `localhost:27017`

## Configuração (principais pontos)

- **Frontend (build-time)**: `REACT_APP_GRAPHQL_URL`, `REACT_APP_TENANT_ID`, `REACT_APP_USER_ID` (definidos como `build.args` no `docker-compose.yml`).
- **Middleware**:
  - `UPSTREAM_BASE_URL` (no compose da raiz: `http://backend:3000`)
  - `UPSTREAM_ALLOWED_PATH_PREFIXES` (no compose da raiz: `/items,/organizations`)
  - `API_KEY` (opcional, protege o `/graphql`)
- **Backend**:
  - `DATABASE_URL` / `MONGO_DATABASE_URL` apontam para `postgres` e `mongo` (containers do compose).
  - Headers obrigatórios para rotas tenant-scoped: `x-tenant-id` e `x-user-id` (UUID).

## Exemplos rápidos

Health do middleware:

```bash
curl -s http://localhost:4000/graphql \
  -H "content-type: application/json" \
  -d '{"query":"{ health { ok service version time } }"}'
```

Lista `items` via GraphQL (proxy para `GET /items` do backend):

```bash
curl -s http://localhost:4000/graphql \
  -H "content-type: application/json" \
  -H "x-tenant-id: 11111111-1111-1111-1111-111111111111" \
  -H "x-user-id: 22222222-2222-2222-2222-222222222222" \
  -d '{"query":"{ upstreamGet(path:\"/items\") }"}'
```

## Documentação do domínio e da UI

- Modelo canônico (multi-tenant): `apps/backend/docs/canonical-model.md`
- Convenções de UI / Central de Cadastramento: `apps/frontend/docs/central-cadastramento.md`
