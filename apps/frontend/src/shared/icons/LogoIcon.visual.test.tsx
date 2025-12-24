import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LogoIcon from './LogoIcon';

describe('LogoIcon (visual)', () => {
  it('gera markup estável', () => {
    expect(renderToStaticMarkup(<LogoIcon fill="#000" size={16} />)).toMatchSnapshot();
  });
});

