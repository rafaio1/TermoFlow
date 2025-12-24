import { makeExecutableSchema } from '@graphql-tools/schema';

import typeDefs from './typeDefs';
import Query from '../resolvers/Query';
import jsonScalarResolver from '../resolvers/scalars/JSON';
import type { GraphQLContext } from '../context'; // Updated path

export const schema = makeExecutableSchema<GraphQLContext>({
  typeDefs: [typeDefs],
  resolvers: {
    JSON: jsonScalarResolver,
    Query,
  },
});
