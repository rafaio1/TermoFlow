import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  LOG_PRETTY: z.coerce.boolean().optional(),
  DATABASE_URL: z.string().min(1),
  MONGO_DATABASE_URL: z.string().min(1),
  DB_CONNECT_RETRIES: z.coerce.number().int().min(0).default(20),
  DB_CONNECT_RETRY_DELAY_MS: z.coerce.number().int().min(0).default(1_000),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
