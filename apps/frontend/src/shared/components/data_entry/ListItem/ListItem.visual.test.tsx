import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ListItem from '.';

describe('ListItem (visual)', () => {
  it('gera markup estável', () => {
    expect(renderToStaticMarkup(<ListItem item="item1" />)).toMatchSnapshot();
  });
});

