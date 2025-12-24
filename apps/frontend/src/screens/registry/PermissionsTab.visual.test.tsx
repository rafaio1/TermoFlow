import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PermissionsTab from './PermissionsTab';

describe('PermissionsTab (visual)', () => {
  it('gera markup estável', () => {
    expect(
      renderToStaticMarkup(
        <PermissionsTab
          permissions={[
            { id: 'p1', key: 'customers.read', description: 'Ler clientes' },
            { id: 'p2', key: 'customers.write', description: 'Editar clientes' }
          ]}
        />
      )
    ).toMatchSnapshot();
  });
});

