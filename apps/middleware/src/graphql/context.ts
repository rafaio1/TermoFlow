import type { Request, Response } from 'express';
import { UpstreamDataSource } from './datasources/UpstreamDataSource';
import type { AppConfig } from '../infrastructure/config/config';
import type { UpstreamDataSourceOptions } from './datasources/UpstreamDataSource';

export interface DataSources {
  upstream: UpstreamDataSource;
}

export interface GraphQLContext extends Record<string, unknown> { // Extend Record
  req: Request;
  res: Response;
  config: AppConfig;
  forwardHeaders: Record<string, string>;
  dataSources: DataSources;
}

interface ContextFactoryOptions {
  req: Request;
  res: Response;
  config: AppConfig;
  upstreamDataSourceOptions: UpstreamDataSourceOptions;
}

export function createGraphQLContext({
  req,
  res,
  config,
  upstreamDataSourceOptions,
}: ContextFactoryOptions): any {
  const forwardHeaders: Record<string, string> = {};
  // Extract headers to forward
  if (req.headers['x-request-id']) {
    forwardHeaders['x-request-id'] = req.headers['x-request-id'] as string;
  }
  // Add other headers to forward as needed

  return {
    req,
    res,
    config,
    forwardHeaders,
    dataSources: {
      upstream: new UpstreamDataSource(upstreamDataSourceOptions),
    },
  };
}
