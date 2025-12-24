const jwt = require('jsonwebtoken');

const { findUserById } = require('../storage/userStore');

async function requireAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'server_misconfigured', message: 'JWT_SECRET is required' });
    return;
  }

  try {
    const payload = jwt.verify(match[1], secret);
    const userId = String(payload?.sub || '');
    if (!userId) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const user = await findUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    req.user = user;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { requireAuth };

