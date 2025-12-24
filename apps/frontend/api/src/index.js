require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { authRouter } = require('./routes/authRoutes');

function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);

  app.use((err, _req, res, _next) => {
    if (err && err.name === 'ZodError') {
      res.status(400).json({ error: 'validation_error', issues: err.issues });
      return;
    }

    const statusCode = Number(err?.statusCode) || 500;
    const errorCode = err?.code || 'internal_error';

    res.status(statusCode).json({
      error: errorCode,
      message: err?.message || 'Internal server error'
    });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${port}`);
  });
}

module.exports = { createApp };
