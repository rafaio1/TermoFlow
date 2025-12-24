// apps/middleware/src/graphql/resolvers/Query.ts

import { normalizeTopLevelKeys, applyJsonFilters } from '../../infrastructure/security/filter';
import type { GraphQLContext } from '../context'; // Updated path
import { UpstreamDataSource } from '../datasources/UpstreamDataSource'; // Import new data source

type EchoArgs = { message: string };
type UpstreamGetArgs = {
  path: string;
  redactSensitive?: boolean;
  includeKeys?: string[] | null;
  excludeKeys?: string[] | null;
};

const Query = {
  health: (_parent: any, _args: any, ctx: GraphQLContext) => ({
    ok: true,
    service: ctx.config.serviceName,
    version: ctx.config.version,
    time: new Date().toISOString(),
  }),
  echo: (_parent: any, args: EchoArgs) => args.message,
  upstreamGet: async (_parent: any, args: UpstreamGetArgs, ctx: GraphQLContext) => {
    // Access the UpstreamDataSource from the context
    const upstreamDataSource = ctx.dataSources.upstream as UpstreamDataSource;
    const value = await upstreamDataSource.getJson(args.path, ctx.forwardHeaders);
    const includeKeys = normalizeTopLevelKeys(args.includeKeys);
    const excludeKeys = normalizeTopLevelKeys(args.excludeKeys);
    return applyJsonFilters({
      value,
      redactSensitive: args.redactSensitive !== false,
      includeKeys,
      excludeKeys,
    });
  },
};

export default Query;
