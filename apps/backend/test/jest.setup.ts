process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.LOG_PRETTY = process.env.LOG_PRETTY ?? 'false';

// Required by src/config/env.ts at import time.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://termoflow:termoflow@localhost:5432/termoflow?schema=public';
process.env.MONGO_DATABASE_URL =
  process.env.MONGO_DATABASE_URL ?? 'mongodb://mongo:mongo@localhost:27017/termoflow?authSource=admin';

