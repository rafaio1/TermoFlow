import pino from 'pino';
import { env } from '../config/env';

const pretty = env.LOG_PRETTY ?? env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(pretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
