const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

let server;
let baseUrl;
let dataDir;

async function jsonRequest(route, { method = 'GET', headers, body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : null),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  const json = raw ? JSON.parse(raw) : null;

  return { response, json };
}

test.before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'termoflow-api-'));

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_secret';
  process.env.DATA_DIR = dataDir;

  const { createApp } = require('../index');
  const app = createApp();

  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  if (dataDir) {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test('GET /api/health retorna ok', async () => {
  const { response, json } = await jsonRequest('/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(json, { ok: true });
});

test('fluxo de cadastro -> login -> me', async () => {
  const email = 'user@example.com';
  const password = 'secret123';
  const name = 'User';

  const register = await jsonRequest('/api/auth/register', {
    method: 'POST',
    body: { email, password, name }
  });

  assert.equal(register.response.status, 201);
  assert.ok(register.json?.token);
  assert.ok(register.json?.user?.id);
  assert.equal(register.json.user.email, email);
  assert.equal(register.json.user.name, name);
  assert.equal(Object.prototype.hasOwnProperty.call(register.json.user, 'passwordHash'), false);

  const login = await jsonRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });

  assert.equal(login.response.status, 200);
  assert.ok(login.json?.token);
  assert.equal(login.json.user.email, email);

  const me = await jsonRequest('/api/auth/me', {
    headers: { authorization: `Bearer ${login.json.token}` }
  });

  assert.equal(me.response.status, 200);
  assert.equal(me.json.user.email, email);
});

test('cadastro duplicado retorna 409', async () => {
  const email = 'dup@example.com';
  const password = 'secret123';

  const first = await jsonRequest('/api/auth/register', { method: 'POST', body: { email, password } });
  assert.equal(first.response.status, 201);

  const second = await jsonRequest('/api/auth/register', { method: 'POST', body: { email, password } });
  assert.equal(second.response.status, 409);
  assert.deepEqual(second.json, { error: 'user_exists' });
});

test('login inválido retorna 401', async () => {
  const email = 'invalid@example.com';
  const password = 'secret123';

  const register = await jsonRequest('/api/auth/register', { method: 'POST', body: { email, password } });
  assert.equal(register.response.status, 201);

  const loginWrongPassword = await jsonRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'wrong' }
  });

  assert.equal(loginWrongPassword.response.status, 401);
  assert.deepEqual(loginWrongPassword.json, { error: 'invalid_credentials' });
});

test('me sem token retorna 401', async () => {
  const { response, json } = await jsonRequest('/api/auth/me');

  assert.equal(response.status, 401);
  assert.deepEqual(json, { error: 'missing_token' });
});

