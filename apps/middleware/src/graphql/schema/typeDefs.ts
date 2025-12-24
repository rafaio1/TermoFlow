// apps/middleware/src/graphql/schema/typeDefs.ts

const typeDefs = /* GraphQL */ `
  scalar JSON

  type Health {
    ok: Boolean!
    service: String!
    version: String!
    time: String!
  }

  type Query {
    health: Health!
    echo(message: String!): String!
    upstreamGet(
      path: String!
      redactSensitive: Boolean = true
      includeKeys: [String!]
      excludeKeys: [String!]
    ): JSON
  }
`;

export default typeDefs;
