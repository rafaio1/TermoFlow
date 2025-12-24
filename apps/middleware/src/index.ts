import 'dotenv/config';

import { getConfig } from './infrastructure/config/config';
import { createApp } from './app';

const config = getConfig();

const app = createApp({
  config,
  upstreamDataSourceOptions: {
    baseUrl: config.upstreamBaseUrl,
    timeoutMs: config.upstreamTimeoutMs,
    allowedPathPrefixes: config.upstreamAllowedPathPrefixes,
    maxResponseBytes: config.upstreamMaxResponseBytes,
    debug: config.nodeEnv !== 'production',
  },
});

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`${config.serviceName} listening on :${config.port} (GraphQL: /graphql)`);
});

server.keepAliveTimeout = config.serverKeepAliveTimeoutMs;
server.headersTimeout = config.serverHeadersTimeoutMs;
server.requestTimeout = config.serverRequestTimeoutMs;
