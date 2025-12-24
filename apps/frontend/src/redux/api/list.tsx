import axios from 'axios';

type GraphqlError = { message?: string };

type GraphqlResponse = {
  data?: {
    upstreamGet?: unknown;
  };
  errors?: GraphqlError[];
};

const GRAPHQL_ENDPOINT = (process.env.REACT_APP_GRAPHQL_URL || 'http://localhost:4000/graphql').trim();
const TENANT_ID =
  (process.env.REACT_APP_TENANT_ID || '11111111-1111-1111-1111-111111111111').trim();
const USER_ID =
  (process.env.REACT_APP_USER_ID || '22222222-2222-2222-2222-222222222222').trim();
const LIST_ITEMS_QUERY = `
  query ListItems {
    upstreamGet(path: "/items")
  }
`;

function ensureGraphqlItem(value: unknown): IItem {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid payload received from middleware.');
  }

  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === 'string' ? candidate.id : candidate.id != null ? String(candidate.id) : '';
  const name = typeof candidate.name === 'string' ? candidate.name : '';

  if (!id || !name) {
    throw new Error('GraphQL response is missing required item fields.');
  }

  return { id, name };
}

function ensureGraphqlList(value: unknown): IItem[] {
  if (!Array.isArray(value)) {
    throw new Error('GraphQL upstream response is not an array.');
  }

  return value.map((item) => ensureGraphqlItem(item));
}

type UpstreamFetchList = () => Promise<IItem[]>;

export const fetchList: UpstreamFetchList = async () => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(TENANT_ID ? { 'x-tenant-id': TENANT_ID } : {}),
    ...(USER_ID ? { 'x-user-id': USER_ID } : {}),
  };

  const response = await axios.post<GraphqlResponse>(
    GRAPHQL_ENDPOINT,
    { query: LIST_ITEMS_QUERY },
    { headers },
  );

  if (response.data?.errors?.length) {
    throw new Error(response.data.errors[0].message ?? 'GraphQL upstream query failed.');
  }

  const payload = response.data?.data?.upstreamGet ?? [];
  return ensureGraphqlList(payload);
};
