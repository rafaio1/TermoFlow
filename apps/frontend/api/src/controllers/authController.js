const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { createUser, findUserByEmail } = require('../storage/userStore');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  const err = new Error('JWT_SECRET is required');
  err.statusCode = 500;
  err.code = 'server_misconfigured';
  throw err;
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function register(req, res, next) {
  try {
    const payload = registerSchema.parse(req.body);
    const email = payload.email.toLowerCase();

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'user_exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await createUser({
      email,
      name: payload.name || null,
      passwordHash
    });

    const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' });
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.toLowerCase();

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const ok = await bcrypt.compare(payload.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: sanitizeUser(req.user) });
}

module.exports = { login, me, register };

