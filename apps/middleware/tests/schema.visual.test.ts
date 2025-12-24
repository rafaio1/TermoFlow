import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';

import { schema } from '../src/schema';

describe('schema (visual)', () => {
  it('matches snapshot', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });
});

