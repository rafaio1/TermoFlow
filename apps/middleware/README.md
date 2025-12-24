# TermoFlow.Middleware (Gateway GraphQL)

> Para subir o stack completo (frontend + middleware + backend + bancos), veja `../README.md`.

Gateway GraphQL (Node.js + TypeScript) entre clientes e serviços REST. O schema é propositalmente pequeno e expõe uma query genérica `upstreamGet` para consumo seguro de endpoints **GET** do backend.

## Como o `upstreamGet` funciona

- Converte `upstreamGet(path: "/items")` em um `GET` para `UPSTREAM_BASE_URL + path`.
- Valida `path` (precisa começar com `/`, não permite `..`, host/protocolo, nem redirects).
- Se `UPSTREAM_ALLOWED_PATH_PREFIXES` estiver definido, só permite paths dentro da allowlist.
- Repassa headers úteis para o upstream (ex.: `x-tenant-id`, `x-user-id`, `x-company-id`, `x-request-id`, `accept-language`).
  - Se o `Authorization` for do tipo `ApiKey ...` (API key do gateway), ele **não** é repassado como token de usuário.
- Pode filtrar o JSON retornado via `includeKeys`/`excludeKeys` e mascara chaves sensíveis (`redactSensitive`).

## Endpoints

- `GET /health` (healthcheck)
- `GET /live` (liveness)
- `GET /ready` (readiness: testa `UPSTREAM_BASE_URL` + `UPSTREAM_HEALTH_PATH`)
- `POST /graphql` (GraphQL)

## Rodar com Docker

Stack completo (recomendado):

```bash
cd ..
docker compose up --build
```

Somente o middleware (necessita configurar `UPSTREAM_BASE_URL`):

```bash
cp .env.example .env
docker compose up --build
```

## Variáveis de ambiente (principais)

- `PORT` (padrão: `4000`)
- `UPSTREAM_BASE_URL` (ex.: `http://backend:3000` no stack completo; `http://localhost:3001` fora do Docker)
- `UPSTREAM_HEALTH_PATH` (padrão: `/health`)
- `UPSTREAM_ALLOWED_PATH_PREFIXES` (opcional, ex.: `/items,/organizations`)
- `API_KEY` (opcional: protege o `/graphql` via `x-api-key` ou `Authorization: ApiKey ...`)
- `CORS_ORIGINS` (padrão: liberado em dev; bloqueado em prod)
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` (rate limit no `/graphql`)
- `MAX_OPERATIONS`, `MAX_QUERY_DEPTH`, `MAX_QUERY_FIELDS`, `MAX_QUERY_LENGTH` (hardening de query)
- `ENABLE_INTROSPECTION` (padrão: `false` em prod)
- `UPSTREAM_MAX_RESPONSE_BYTES` (limite de bytes lidos do upstream)
- `SERVER_HEADERS_TIMEOUT_MS` / `SERVER_REQUEST_TIMEOUT_MS` / `SERVER_KEEP_ALIVE_TIMEOUT_MS` (hardening contra conexões lentas)

## Exemplos

Health (GraphQL):

```bash
curl -s http://localhost:4000/graphql \
  -H "content-type: application/json" \
  -d '{"query":"{ health { ok service version time } }"}'
```

Upstream (precisa `UPSTREAM_BASE_URL`):

```bash
curl -s http://localhost:4000/graphql \
  -H "content-type: application/json" \
  -H "x-tenant-id: 11111111-1111-1111-1111-111111111111" \
  -H "x-user-id: 22222222-2222-2222-2222-222222222222" \
  -d '{"query":"{ upstreamGet(path:\"/items\") }"}'
```

## Testes

Local:

```bash
npm install
npm test
```

Via Docker:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test
```
