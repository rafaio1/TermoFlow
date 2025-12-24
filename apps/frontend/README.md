# TermoFlow.Frontend (SPA)

> Para subir o stack completo (frontend + middleware + backend + bancos), veja `../README.md`.

SPA do TermoFlow (Create React App + Ant Design). Em produção ela é servida via Nginx e consome o middleware GraphQL para acessar endpoints REST do backend via `upstreamGet`.

## Stack / features

- React + TypeScript
- Ant Design
- LESS
- Redux + redux-saga
- TSLint + StyleLint + Prettier (legado do boilerplate)

## Variáveis de ambiente

As variáveis são lidas em build-time (CRA):

- `REACT_APP_GRAPHQL_URL` (padrão: `http://localhost:4000/graphql`)
- `REACT_APP_TENANT_ID` (padrão: `11111111-1111-1111-1111-111111111111`)
- `REACT_APP_USER_ID` (padrão: `22222222-2222-2222-2222-222222222222`)

O frontend inclui esses IDs como headers `x-tenant-id` e `x-user-id` nas chamadas ao GraphQL.

## Rodando no stack completo (Docker)

O `docker-compose.yml` da raiz injeta:

- `REACT_APP_GRAPHQL_URL=/api/graphql` (same-origin) e o Nginx faz proxy de `/api/*` para o middleware
- `REACT_APP_TENANT_ID` / `REACT_APP_USER_ID` com valores de demo

Subir tudo:

```bash
cd ..
docker compose up --build
```

Frontend em `http://localhost:3000/` (GraphQL via `http://localhost:3000/api/graphql`).

## Desenvolvimento local (sem Docker)

1. Suba o middleware e o backend (via Docker na raiz, ou como preferir).
2. Rode o frontend:

```bash
cd TermoFlow.Frontend
npm ci --legacy-peer-deps
REACT_APP_GRAPHQL_URL=http://localhost:4000/graphql npm start
```

Abra `http://localhost:3000/`.

## Exemplo de query

```graphql
query ListItems {
  upstreamGet(path: "/items")
}
```

## Notas

- Existe um diretório `api/` dentro deste módulo (herança do boilerplate) que **não** faz parte da stack do TermoFlow descrita no `../README.md`.
- Convenções de UI / Central de Cadastramento: `docs/central-cadastramento.md`.
