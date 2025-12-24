import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../logging/logger';

type RetryOptions = {
  retries: number;
  delayMs: number;
  label: string;
};

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let attempt = 0;

  // retries=0 means "try once"
  // retries=1 means "try + 1 retry" (2 total), etc.
  // We'll interpret as max retries after the first attempt.
  // Total attempts = retries + 1.
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= options.retries) throw err;
      attempt += 1;
      logger.warn({ err, attempt, retries: options.retries }, `${options.label} failed, retrying`);
      await sleep(options.delayMs);
    }
  }
}

