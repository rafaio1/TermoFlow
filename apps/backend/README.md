# TermoFlow.Backend (API REST)

> Para subir o stack completo (frontend + middleware + backend + bancos), veja `../README.md`.

API REST (Node.js + Express + TypeScript) responsável pelos endpoints tenant-scoped e pela persistência em Postgres (Prisma) + auditoria em MongoDB.

## Stack

- API: Node.js + Express
- Validação: Zod
- Logs: Pino
- PostgreSQL: Prisma (migrations)
- MongoDB: driver oficial (`mongodb`)

## Headers de contexto (obrigatórios)

As rotas tenant-scoped exigem UUIDs válidos:

- `x-tenant-id`: tenant atual
- `x-user-id`: usuário/ator da ação
- `x-company-id`: opcional (quando o endpoint precisar de contexto por empresa)

## Rotas

- `GET /` -> status do serviço
- `GET /health` -> healthcheck (inclui Postgres + Mongo)
- `GET /items` -> lista itens (Postgres)
- `POST /items` -> cria item (Postgres) e grava audit log (Mongo)
- `GET /organizations` -> lista organizações (Postgres)
- `POST /organizations` -> cria organização (Postgres)
- `PATCH /organizations/:id` -> atualiza organização (Postgres)
- `DELETE /organizations/:id` -> soft delete organização (Postgres)

## Rodando com Docker (módulo isolado)

1. `cd TermoFlow.Backend`
2. Copie `.env.example` para `.env` (opcional; o `docker-compose.yml` tem defaults)
3. Suba os bancos:
   ```bash
   docker compose up -d postgres mongo
   ```
4. Aplique as migrations do Postgres:
   ```bash
   docker compose --profile tools run --rm migrate
   ```
5. Suba a API:
   ```bash
   docker compose up --build api
   ```

API em `http://localhost:3000`.

## Rodando no stack completo (compose da raiz)

- Ao subir via `TermoFlow/docker-compose.yml`, a API fica exposta em `http://localhost:3001` (porta interna `3000`).

## Prisma

- `npm run prisma:migrate:dev` -> cria/aplica migrations (dev)
- `npm run prisma:migrate:deploy` -> aplica migrations existentes (prod)
- `npm run prisma:studio` -> UI do Prisma

Criar migration dentro do Docker (gera arquivos em `prisma/migrations`):

```bash
docker compose up -d postgres
docker compose --profile tools run --rm prisma migrate dev --name canonical
```

## Desenvolvimento local (sem Docker)

1. Suba os bancos (compose do módulo): `docker compose up -d postgres mongo`
2. Instale dependências: `npm install`
3. Rode em modo dev: `npm run dev`

## Testes

Unitários (Jest):

```bash
npm test
```

Cobertura (gera HTML em `coverage/lcov-report/index.html`):

```bash
npm run test:coverage
```

Via Docker:

```bash
docker compose --profile tools run --rm test
```

Testes "visuais":

- Requisições em `docs/api.http` (VS Code REST Client / JetBrains HTTP Client)
- Smoke test em PowerShell: `./scripts/smoke.ps1 -BaseUrl http://localhost:3000`

## Modelo canônico (Central de Cadastramento)

Veja `docs/canonical-model.md`.
