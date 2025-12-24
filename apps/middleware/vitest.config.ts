import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    mainFields: ['main'],
    alias: {
      graphql: require.resolve('graphql/index.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10_000,
    deps: {
      inline: ['graphql', 'graphql-http', '@graphql-tools/schema', 'graphql-type-json'],
    },
  },
});
