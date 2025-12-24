const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const usersFile = process.env.USERS_FILE || path.join(dataDir, 'users.json');

async function ensureStore() {
  await fs.mkdir(path.dirname(usersFile), { recursive: true });

  try {
    await fs.access(usersFile);
  } catch (_err) {
    await fs.writeFile(usersFile, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();

  const raw = await fs.readFile(usersFile, 'utf8');
  try {
    const store = JSON.parse(raw);
    if (!store || typeof store !== 'object') return { users: [] };
    if (!Array.isArray(store.users)) return { users: [] };
    return store;
  } catch (_err) {
    return { users: [] };
  }
}

async function writeStore(store) {
  await ensureStore();

  const tmp = `${usersFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tmp, usersFile);
}

async function findUserByEmail(email) {
  const store = await readStore();
  return store.users.find(u => u.email === email.toLowerCase()) || null;
}

async function findUserById(id) {
  const store = await readStore();
  return store.users.find(u => u.id === id) || null;
}

async function createUser({ email, name, passwordHash }) {
  const store = await readStore();

  const user = {
    id: randomUUID(),
    email: email.toLowerCase(),
    name,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  store.users.push(user);
  await writeStore(store);

  return user;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById
};

